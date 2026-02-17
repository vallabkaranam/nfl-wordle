from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import nflreadpy as nfl
import pandas as pd
from datetime import date
import random
import os
import json
from pathlib import Path

app = FastAPI()

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global data cache
players_db = []

TEAM_MAP = {
    'ARI': {'conf': 'NFC', 'div': 'West'},
    'ATL': {'conf': 'NFC', 'div': 'South'},
    'BAL': {'conf': 'AFC', 'div': 'North'},
    'BUF': {'conf': 'AFC', 'div': 'East'},
    'CAR': {'conf': 'NFC', 'div': 'South'},
    'CHI': {'conf': 'NFC', 'div': 'North'},
    'CIN': {'conf': 'AFC', 'div': 'North'},
    'CLE': {'conf': 'AFC', 'div': 'North'},
    'DAL': {'conf': 'NFC', 'div': 'East'},
    'DEN': {'conf': 'AFC', 'div': 'West'},
    'DET': {'conf': 'NFC', 'div': 'North'},
    'GB': {'conf': 'NFC', 'div': 'North'},
    'HOU': {'conf': 'AFC', 'div': 'South'},
    'IND': {'conf': 'AFC', 'div': 'South'},
    'JAX': {'conf': 'AFC', 'div': 'South'},
    'KC': {'conf': 'AFC', 'div': 'West'},
    'LAC': {'conf': 'AFC', 'div': 'West'},
    'LAR': {'conf': 'NFC', 'div': 'West'},
    'LV': {'conf': 'AFC', 'div': 'West'},
    'MIA': {'conf': 'AFC', 'div': 'East'},
    'MIN': {'conf': 'NFC', 'div': 'North'},
    'NE': {'conf': 'AFC', 'div': 'East'},
    'NO': {'conf': 'NFC', 'div': 'South'},
    'NYG': {'conf': 'NFC', 'div': 'East'},
    'NYJ': {'conf': 'AFC', 'div': 'East'},
    'PHI': {'conf': 'NFC', 'div': 'East'},
    'PIT': {'conf': 'AFC', 'div': 'North'},
    'SEA': {'conf': 'NFC', 'div': 'West'},
    'SF': {'conf': 'NFC', 'div': 'West'},
    'TB': {'conf': 'NFC', 'div': 'South'},
    'TEN': {'conf': 'AFC', 'div': 'South'},
    'WAS': {'conf': 'NFC', 'div': 'East'},
}


DATA_DIR = Path("data")
CACHE_FILE = DATA_DIR / "players.json"

@app.on_event("startup")
def load_data():
    global players_db
    print("Loading NFL roster data...")

    # 1. Try Loading from Cache
    if CACHE_FILE.exists():
        try:
            print(f"Loading from cache: {CACHE_FILE}")
            with open(CACHE_FILE, "r") as f:
                players_db = json.load(f)
            print(f"Loaded {len(players_db)} players from cache.")
            return
        except Exception as e:
            print(f"Error reading cache: {e}. Falling back to fetch.")

    # 2. Fetch if no cache
    print("Cache miss. Fetching from nflreadpy...")
    try:
        # User requested 2025 primarily
        df = nfl.load_rosters([2025])
    except Exception as e:
        print(f"Error loading 2025 data, falling back to 2024 for dev if 2025 unavailable: {e}")
        df = nfl.load_rosters([2024])
    
    print(f"Data Loaded. Type: {type(df)}")
    
    # Force conversion to pandas if likely Polars
    if hasattr(df, "to_pandas"):
        print("Converting to pandas...")
        df = df.to_pandas()
    
    # Filter for active players - REMOVED per user feedback to include Injured/Reserve players
    # "We want to get everyone (even if they're injured) as long as they're on the team"
    # if 'status' in df.columns:
    #    df = df[df['status'] == 'ACT']
    
    # Select cols: player_name, team, position, depth_chart_position, jersey_number, headshot_url
    needed_cols = ['full_name', 'team', 'position', 'jersey_number', 'headshot_url']
    # Ensure cols exist
    existing_cols = [c for c in needed_cols if c in df.columns]
    df = df[existing_cols]
    
    # Drop NAs
    df = df.dropna()
    
    # Convert to list of dicts
    temp_players = df.to_dict('records')
    
    cleaned_players = []
    
    for p in temp_players:
        team_info = TEAM_MAP.get(p.get('team'))
        if team_info:
            # Rigorous jersey parsing: FIX "0.0" issue
            try:
                raw_jersey = p.get('jersey_number')
                if pd.isna(raw_jersey):
                    jersey_num = 0 
                else:
                    # Handle floats like 12.0 or strings "12"
                    jersey_num = int(float(raw_jersey))
            except (ValueError, TypeError):
                jersey_num = 0

            cleaned_players.append({
                'name': p.get('full_name'),
                'team': p.get('team'),
                'position': p.get('position'),
                'jersey_number': jersey_num,
                'headshot': p.get('headshot_url'),
                'conf': team_info['conf'],
                'div': team_info['div']
            })
            
    players_db = cleaned_players
    print(f"Loaded {len(players_db)} players from API.")

    # 3. Save to Cache
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, "w") as f:
            json.dump(players_db, f)
        print(f"Saved cache to {CACHE_FILE}")
    except Exception as e:
        print(f"Failed to save cache: {e}")

@app.get("/api/players")
def get_players(offense_only: bool = False):
    if offense_only:
        offensive_positions = ['QB', 'RB', 'WR', 'TE', 'FB']
        return [p for p in players_db if p['position'] in offensive_positions]
    return players_db

@app.get("/api/daily")
def get_daily_player(offense_only: bool = False):
    if not players_db:
        return {"error": "No data loaded"}
    
    # Filter candidates based on mode
    candidates = players_db
    if offense_only:
        offensive_positions = ['QB', 'RB', 'WR', 'TE', 'FB']
        candidates = [p for p in players_db if p['position'] in offensive_positions]
        if not candidates:
             # Fallback if no offensive players found (unlikely)
             candidates = players_db

    # Deterministic daily player based on date
    today = date.today()
    seed_value = today.toordinal()
    
    # If offense_only mode, shift seed to pick a DIFFERENT player than the normal mode
    # This ensures global consistency: Everyone on "Standard" gets Player A, everyone on "Offense" gets Player B.
    if offense_only:
        seed_value += 100

    random.seed(seed_value)
    
    daily_player = random.choice(candidates)
    return daily_player
