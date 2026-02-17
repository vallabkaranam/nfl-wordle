# MISSION: NFL Wordle Production Spec (2025-2026 Season)

## 1. Data Layer (Python FastAPI)
- **Season:** Fetch 2025-2026 active rosters using `nflreadpy.load_rosters([2025])`.
- **Jersey Numbers:** Fix the logic to ensure `jersey_number` is correctly parsed as an integer from the dataframe.
- **Offensive Filter:** Add a boolean toggle parameter to `/api/players`.
  - Offensive Positions: `['QB', 'RB', 'WR', 'TE', 'FB']`.
- **Mapping:** Continue using the 32-team Conference/Division mapping for logic.

## 2. Gameplay & UI (Next.js)
- **Search & Input:**
  - Implement `fuse.js` for fuzzy matching on `player_name`.
  - Add a UI Toggle: "Offense Only" that filters the search results.
- **Game State:**
  - Track a `guesses` array (max length 5).
  - **Win State:** If player is found within 5 guesses, display a "TOUCHDOWN!" modal with player stats.
  - **Loss State:** If 5 guesses are reached without a match, display "TURNOVER ON DOWNS" and reveal the target player.
- **Visuals:**
  - Standard 5-column grid (Team, Conf, Div, Pos, Jersey).
  - Correct 3D flip animations using `framer-motion`.

## 3. Deployment Requirements
- Ensure `requirements.txt` includes `nflreadpy`, `pandas`, and `fastapi`.
- Ensure `package.json` includes `fuse.js`, `framer-motion`, and `lucide-react`.