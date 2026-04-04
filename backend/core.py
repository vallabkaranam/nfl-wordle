from __future__ import annotations

from datetime import datetime
import random
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

PUZZLE_TIME_ZONE = "America/New_York"
OFFENSIVE_POSITIONS = {"QB", "RB", "WR", "TE", "FB"}

TEAM_MAP = {
    "ARI": {"conf": "NFC", "div": "West"},
    "ATL": {"conf": "NFC", "div": "South"},
    "BAL": {"conf": "AFC", "div": "North"},
    "BUF": {"conf": "AFC", "div": "East"},
    "CAR": {"conf": "NFC", "div": "South"},
    "CHI": {"conf": "NFC", "div": "North"},
    "CIN": {"conf": "AFC", "div": "North"},
    "CLE": {"conf": "AFC", "div": "North"},
    "DAL": {"conf": "NFC", "div": "East"},
    "DEN": {"conf": "AFC", "div": "West"},
    "DET": {"conf": "NFC", "div": "North"},
    "GB": {"conf": "NFC", "div": "North"},
    "HOU": {"conf": "AFC", "div": "South"},
    "IND": {"conf": "AFC", "div": "South"},
    "JAX": {"conf": "AFC", "div": "South"},
    "KC": {"conf": "AFC", "div": "West"},
    "LAC": {"conf": "AFC", "div": "West"},
    "LAR": {"conf": "NFC", "div": "West"},
    "LV": {"conf": "AFC", "div": "West"},
    "MIA": {"conf": "AFC", "div": "East"},
    "MIN": {"conf": "NFC", "div": "North"},
    "NE": {"conf": "AFC", "div": "East"},
    "NO": {"conf": "NFC", "div": "South"},
    "NYG": {"conf": "NFC", "div": "East"},
    "NYJ": {"conf": "AFC", "div": "East"},
    "PHI": {"conf": "NFC", "div": "East"},
    "PIT": {"conf": "AFC", "div": "North"},
    "SEA": {"conf": "NFC", "div": "West"},
    "SF": {"conf": "NFC", "div": "West"},
    "TB": {"conf": "NFC", "div": "South"},
    "TEN": {"conf": "AFC", "div": "South"},
    "WAS": {"conf": "NFC", "div": "East"},
}


def get_puzzle_date(timezone_name: str = PUZZLE_TIME_ZONE) -> str:
    return datetime.now(ZoneInfo(timezone_name)).date().isoformat()


def normalize_player(record: dict[str, Any]) -> dict[str, Any] | None:
    team = record.get("team")
    team_info = TEAM_MAP.get(team)
    if not team_info:
        return None

    try:
        raw_jersey = record.get("jersey_number")
        if pd.isna(raw_jersey):
            jersey_num = 0
        else:
            jersey_num = int(float(raw_jersey))
    except (ValueError, TypeError):
        jersey_num = 0

    name = str(record.get("full_name") or record.get("name") or "").strip()
    position = str(record.get("position") or "").strip()
    if not name or not position:
        return None

    return {
        "name": name,
        "team": team,
        "position": position,
        "jersey_number": jersey_num,
        "conf": team_info["conf"],
        "div": team_info["div"],
    }


def normalize_players(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned_players: list[dict[str, Any]] = []
    seen_ids: set[tuple[str, str, int]] = set()

    for record in records:
        normalized = normalize_player(record)
        if not normalized:
            continue

        player_id = (
            normalized["name"],
            normalized["team"],
            normalized["jersey_number"],
        )
        if player_id in seen_ids:
            continue

        seen_ids.add(player_id)
        cleaned_players.append(normalized)

    cleaned_players.sort(key=lambda player: (player["name"], player["team"], player["jersey_number"]))
    return cleaned_players


def get_candidates(players: list[dict[str, Any]], offense_only: bool = False) -> list[dict[str, Any]]:
    if not players:
        return []

    if not offense_only:
        return players

    candidates = [player for player in players if player["position"] in OFFENSIVE_POSITIONS]
    return candidates or players


def select_daily_player(
    candidates: list[dict[str, Any]],
    offense_only: bool = False,
    timezone_name: str = PUZZLE_TIME_ZONE,
) -> dict[str, Any]:
    if not candidates:
        raise ValueError("No player data available")

    seed_value = int(get_puzzle_date(timezone_name).replace("-", ""))
    if offense_only:
        seed_value += 100

    return random.Random(seed_value).choice(candidates)
