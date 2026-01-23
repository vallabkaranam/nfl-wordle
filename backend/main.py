from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import nflreadpy as nfl
import pandas as pd
from datetime import date
import random

app = FastAPI()

# CORS
origins = [
    "http://localhost:3000",
]

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

@app.on_event("startup")
def load_data():
    global players_db
    print("Loading NFL 2025 roster data...")
    # Load 2025 rosters
    try:
        df = nfl.load_rosters([2025])
    except Exception as e:
        print(f"Error loading 2025 data, falling back to 2024 for dev if 2025 unavailable: {e}")
        df = nfl.load_rosters([2024])
    
    print(f"Data Loaded. Type: {type(df)}")
    
    # Force conversion to pandas if likely Polars
    if hasattr(df, "to_pandas"):
        print("Converting to pandas...")
        df = df.to_pandas()
    
    # Filter for active players
    if 'status' in df.columns:
        df = df[df['status'] == 'ACT']
    
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
            # Rigorous jersey parsing
            try:
                raw_jersey = p.get('jersey_number')
                if pd.isna(raw_jersey):
                    jersey_num = 0 # Default fallback
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
    print(f"Loaded {len(players_db)} players.")

@app.get("/api/players")
def get_players(offense_only: bool = False):
    if offense_only:
        offensive_positions = ['QB', 'RB', 'WR', 'TE', 'FB']
        return [p for p in players_db if p['position'] in offensive_positions]
    return players_db

@app.get("/api/daily")
def get_daily_player():
    if not players_db:
        return {"error": "No data loaded"}
    
    # Deterministic daily player based on date
    today = date.today()
    seed_value = today.toordinal()
    random.seed(seed_value)
    
    # Optional: ensure daily player is interesting (e.g. offense only?) 
    # Blueprint doesn't specify, but safer to keep it random from all for now, 
    # or obscure linemen might be hard. Let's stick to random from all for V2 spec compliance unless asked.
    
    daily_player = random.choice(players_db)
    return daily_player
