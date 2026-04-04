from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import nfl_data_py as nfl

from core import (
    get_candidates,
    get_puzzle_date,
    get_weekly_puzzle_key,
    normalize_players,
    select_daily_player,
    select_weekly_player,
)

app = FastAPI(title="Roster Riddle API")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CACHE_FILE = DATA_DIR / "players.json"
EVENT_LOG_FILE = DATA_DIR / "events.log"
LEADERBOARD_FILE = DATA_DIR / "leaderboard.json"
WAITLIST_FILE = DATA_DIR / "waitlist.json"
PUZZLE_TIME_ZONE = os.getenv("PUZZLE_TIMEZONE", "America/New_York")

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

players_db: list[dict[str, Any]] = []


class EventPayload(BaseModel):
    name: str
    puzzle_date: str | None = None
    mode: str | None = None
    outcome: str | None = None
    guess_count: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class LeaderboardSubmission(BaseModel):
    name: str = Field(min_length=2, max_length=24)
    puzzle_type: str = Field(pattern="^(daily|weekly)$")
    mode: str = Field(pattern="^(standard|fantasy|offense|weekly)$")
    puzzle_key: str
    guess_count: int = Field(ge=1, le=5)


class WaitlistSubmission(BaseModel):
    email: str = Field(min_length=5, max_length=200)
    source: str = Field(default="site", max_length=60)


def read_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default

    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return default


def write_json_file(path: Path, payload: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file)


def write_event(payload: EventPayload) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with EVENT_LOG_FILE.open("a", encoding="utf-8") as event_log:
        event_log.write(
            json.dumps(
                {
                    "timestamp": datetime.now(ZoneInfo(PUZZLE_TIME_ZONE)).isoformat(),
                    **payload.model_dump(),
                }
            )
        )
        event_log.write("\n")


def get_leaderboard_entries(puzzle_type: str, mode: str, puzzle_key: str) -> list[dict[str, Any]]:
    entries = read_json_file(LEADERBOARD_FILE, [])
    accepted_modes = {mode}
    if mode == "fantasy":
        accepted_modes.add("offense")
    elif mode == "offense":
        accepted_modes.add("fantasy")

    filtered_entries = [
        entry
        for entry in entries
        if entry.get("puzzle_type") == puzzle_type and entry.get("mode") in accepted_modes and entry.get("puzzle_key") == puzzle_key
    ]
    filtered_entries.sort(key=lambda entry: (entry.get("guess_count", 99), entry.get("timestamp", "")))
    normalized_entries = [{**entry, "mode": "fantasy" if entry.get("mode") == "offense" else entry.get("mode")} for entry in filtered_entries]
    return normalized_entries[:10]


def save_leaderboard_entry(payload: LeaderboardSubmission) -> list[dict[str, Any]]:
    entries = read_json_file(LEADERBOARD_FILE, [])
    normalized_mode = "fantasy" if payload.mode == "offense" else payload.mode
    new_entry = {
        **payload.model_dump(),
        "mode": normalized_mode,
        "name": payload.name.strip(),
        "timestamp": datetime.now(ZoneInfo(PUZZLE_TIME_ZONE)).isoformat(),
    }

    same_bucket = [
        entry
        for entry in entries
        if not (
            entry.get("puzzle_type") == payload.puzzle_type
            and entry.get("mode") in {normalized_mode, "offense" if normalized_mode == "fantasy" else normalized_mode}
            and entry.get("puzzle_key") == payload.puzzle_key
            and entry.get("name", "").lower() == payload.name.strip().lower()
        )
    ]
    same_bucket.append(new_entry)

    grouped_entries = [
        entry
        for entry in same_bucket
        if entry.get("puzzle_type") == payload.puzzle_type
        and entry.get("mode") in {normalized_mode, "offense" if normalized_mode == "fantasy" else normalized_mode}
        and entry.get("puzzle_key") == payload.puzzle_key
    ]
    grouped_entries.sort(key=lambda entry: (entry.get("guess_count", 99), entry.get("timestamp", "")))

    retained_names: set[str] = set()
    top_entries: list[dict[str, Any]] = []
    for entry in grouped_entries:
        normalized_name = entry.get("name", "").strip().lower()
        if normalized_name in retained_names:
            continue
        retained_names.add(normalized_name)
        top_entries.append(entry)
        if len(top_entries) == 10:
            break

    untouched_entries = [
        entry
        for entry in same_bucket
        if not (
            entry.get("puzzle_type") == payload.puzzle_type
            and entry.get("mode") in {normalized_mode, "offense" if normalized_mode == "fantasy" else normalized_mode}
            and entry.get("puzzle_key") == payload.puzzle_key
        )
    ]
    write_json_file(LEADERBOARD_FILE, untouched_entries + top_entries)
    return top_entries


def save_waitlist_entry(payload: WaitlistSubmission) -> int:
    entries = read_json_file(WAITLIST_FILE, [])
    normalized_email = payload.email.lower()
    if "@" not in normalized_email or "." not in normalized_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    if any(entry.get("email") == normalized_email for entry in entries):
        return len(entries)

    entries.append(
        {
            "email": normalized_email,
            "source": payload.source,
            "timestamp": datetime.now(ZoneInfo(PUZZLE_TIME_ZONE)).isoformat(),
        }
    )
    write_json_file(WAITLIST_FILE, entries)
    return len(entries)


@app.on_event("startup")
def load_data() -> None:
    global players_db
    print("Loading roster data...")

    if CACHE_FILE.exists():
        try:
            print(f"Loading from cache: {CACHE_FILE}")
            with CACHE_FILE.open("r", encoding="utf-8") as cache_file:
                cached_records = json.load(cache_file)
            players_db = normalize_players(cached_records)
            print(f"Loaded {len(players_db)} players from cache.")
            return
        except Exception as exc:
            print(f"Error reading cache: {exc}. Falling back to live fetch.")

    print("Cache miss. Fetching roster data...")
    try:
        roster_df = nfl.import_rosters([2025])
    except Exception as exc:
        print(f"Error loading 2025 data, falling back to 2024: {exc}")
        roster_df = nfl.import_rosters([2024])

    if hasattr(roster_df, "to_pandas"):
        roster_df = roster_df.to_pandas()

    needed_cols = ["full_name", "team", "position", "jersey_number"]
    existing_cols = [column for column in needed_cols if column in roster_df.columns]
    roster_df = roster_df[existing_cols].dropna()

    players_db = normalize_players(roster_df.to_dict("records"))
    print(f"Loaded {len(players_db)} players from live data.")

    try:
        write_json_file(CACHE_FILE, players_db)
        print(f"Saved cache to {CACHE_FILE}")
    except Exception as exc:
        print(f"Failed to save cache: {exc}")


@app.get("/api/health")
def get_health() -> dict[str, Any]:
    return {
        "status": "ok" if players_db else "degraded",
        "player_count": len(players_db),
        "puzzle_date": get_puzzle_date(PUZZLE_TIME_ZONE),
        "weekly_key": get_weekly_puzzle_key(PUZZLE_TIME_ZONE),
        "timezone": PUZZLE_TIME_ZONE,
    }


@app.get("/api/players")
def get_players(fantasy_only: bool = False, offense_only: bool = False) -> list[dict[str, Any]]:
    candidates = get_candidates(players_db, fantasy_only or offense_only)
    if not candidates:
        raise HTTPException(status_code=503, detail="Player data is not available yet.")
    return candidates


@app.get("/api/daily")
def get_daily_player(fantasy_only: bool = False, offense_only: bool = False) -> dict[str, Any]:
    resolved_fantasy_only = fantasy_only or offense_only
    candidates = get_candidates(players_db, resolved_fantasy_only)
    if not candidates:
        raise HTTPException(status_code=503, detail="Player data is not available yet.")
    return select_daily_player(candidates, resolved_fantasy_only, PUZZLE_TIME_ZONE)


@app.get("/api/weekly")
def get_weekly_player() -> dict[str, Any]:
    if not players_db:
        raise HTTPException(status_code=503, detail="Player data is not available yet.")
    return select_weekly_player(players_db, PUZZLE_TIME_ZONE)


@app.get("/api/leaderboard")
def get_leaderboard(puzzle_type: str = "daily", mode: str = "standard", puzzle_key: str | None = None) -> dict[str, Any]:
    if puzzle_type not in {"daily", "weekly"}:
        raise HTTPException(status_code=400, detail="Invalid puzzle type.")

    if mode == "offense":
        mode = "fantasy"

    resolved_key = puzzle_key or (
        get_weekly_puzzle_key(PUZZLE_TIME_ZONE) if puzzle_type == "weekly" else get_puzzle_date(PUZZLE_TIME_ZONE)
    )
    return {
        "puzzle_type": puzzle_type,
        "mode": mode,
        "puzzle_key": resolved_key,
        "entries": get_leaderboard_entries(puzzle_type, mode, resolved_key),
    }


@app.post("/api/leaderboard")
def post_leaderboard(payload: LeaderboardSubmission) -> dict[str, Any]:
    return {
        "status": "accepted",
        "entries": save_leaderboard_entry(payload),
    }


@app.post("/api/waitlist")
def post_waitlist(payload: WaitlistSubmission) -> dict[str, Any]:
    return {
        "status": "accepted",
        "count": save_waitlist_entry(payload),
    }


@app.post("/api/events")
def post_event(payload: EventPayload) -> dict[str, str]:
    write_event(payload)
    return {"status": "accepted"}
