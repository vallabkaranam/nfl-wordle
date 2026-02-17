# MISSION: NFL Wordle Single-Shot Build

## 1. Technical Stack
- **Backend:** Python 3.10+ / FastAPI / nflreadpy (Data fetching).
- **Frontend:** Next.js 14+ / Tailwind CSS / Framer Motion (Animations).
- **Data Source:** Automated fetch from `nflverse` (roster data).

## 2. Backend Requirements (/backend)
### main.py
- **CORS:** Enable `CORSMiddleware` to allow `http://localhost:3000`.
- **Data Fetching:** Use `nflreadpy.load_rosters([2025])` to get active players.
- **Mapping:** Use the provided dictionary to map team abbreviations to 'Conference' and 'Division'.
- **Endpoints:**
  - `GET /api/players`: Returns minified player list: `{name, team, pos, jersey, conf, div, headshot}`.
  - `GET /api/daily`: Deterministically returns one player based on `date.today()`.

### requirements.txt
fastapi, uvicorn, nflreadpy, pandas

## 3. Frontend Requirements (/frontend)
### Design & CSS
- **Theme:** Dark mode (`bg-zinc-950`, `text-white`).
- **Grid Layout:** Horizontal 5-column row for guesses: [Conf, Div, Team, Pos, Jersey #].
- **Wordle Colors:** - Green: `#6aaa64` (Exact match)
  - Yellow: `#c9b458` (Conference match, wrong Division)
  - Dark Gray: `#3a3a3c` (No match)
- **Animation:** Use `framer-motion` for a 180-degree `rotateY` flip when a guess is submitted.

### Logic (Comparison Engine)
- **Jersey Numbers:** Display '↑' if the target player's number is higher, '↓' if lower.
- **Search:** Implement a search bar with fuzzy filtering using `fuse.js`.

## 4. Execution Workflow for Agent
1. Initialize FastAPI in `/backend` and install dependencies.
2. Initialize Next.js in `/frontend` with Tailwind and Lucide-React.
3. Build the `ComparisonEngine` utility to match the Wordle color rules.
4. Implement the `GuessRow` component with 3D flip animations.
5. Use browser subagent to verify: Search 'Patrick Mahomes' -> Click -> Observe 5 flipping green tiles.