from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from core import (
    get_candidates,
    get_puzzle_date,
    normalize_players,
    select_daily_player,
)
import nfl_data_py as nfl

app = FastAPI(title="Roster Riddle API")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CACHE_FILE = DATA_DIR / "players.json"
EVENT_LOG_FILE = DATA_DIR / "events.log"
PUZZLE_TIME_ZONE = os.getenv("PUZZLE_TIMEZONE", "America/New_York")

# CORS
origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global data cache
players_db: list[dict[str, Any]] = []

class EventPayload(BaseModel):
    name: str
    puzzle_date: str | None = None
    mode: str | None = None
    outcome: str | None = None
    guess_count: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

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
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with CACHE_FILE.open("w", encoding="utf-8") as cache_file:
            json.dump(players_db, cache_file)
        print(f"Saved cache to {CACHE_FILE}")
    except Exception as exc:
        print(f"Failed to save cache: {exc}")


@app.get("/api/health")
def get_health() -> dict[str, Any]:
    return {
        "status": "ok" if players_db else "degraded",
        "player_count": len(players_db),
        "puzzle_date": get_puzzle_date(),
        "timezone": PUZZLE_TIME_ZONE,
    }


@app.get("/api/players")
def get_players(offense_only: bool = False) -> list[dict[str, Any]]:
    candidates = get_candidates(players_db, offense_only)
    if not candidates:
        raise HTTPException(status_code=503, detail="Player data is not available yet.")
    return candidates


@app.get("/api/daily")
def get_daily_player(offense_only: bool = False) -> dict[str, Any]:
    candidates = get_candidates(players_db, offense_only)
    if not candidates:
        raise HTTPException(status_code=503, detail="Player data is not available yet.")
    return select_daily_player(candidates, offense_only, PUZZLE_TIME_ZONE)


@app.post("/api/events")
def post_event(payload: EventPayload) -> dict[str, str]:
    write_event(payload)
    return {"status": "accepted"}
