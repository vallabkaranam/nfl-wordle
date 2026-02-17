# NFL Wordle 🏈

A daily NFL player guessing game inspired by Wordle and Weddle. Users have 5 guesses to identify a specific active NFL player based on their team, conference, division, position, and jersey number.

## 🚀 Overview

- **Daily Refresh:** A new player is deterministically selected every day at midnight.
- **Visual Feedback:**
  - 🟩 **Green:** Exact match
  - 🟨 **Yellow:** Close match (Same Conference but wrong Division)
  - ⬛ **Gray:** No match
  - ⬆️/⬇️ **Arrows:** Jersey number is higher or lower
- **Modes:**
  - **Standard:** Any active player.
  - **Offense Only:** Filters hidden target and searchable players to offensive positions (QB, RB, WR, TE, FB).

## 🛠 Tech Stack

- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4, Framer Motion, Canvas Confetti.
- **Backend:** FastAPI (Python 3.11), `nflreadpy` for data sourcing.
- **Data:** Live roster data fetched from `nflreadpy` (Github) and cached locally for performance.

## 📂 Repository Structure

- `frontend/`: Next.js application (UI, Game Logic, Search).
- `backend/`: FastAPI application (Data sourcing, Daily Seeding API).
- `data/`: Local cache for player data (generated on startup).

## 💻 Local Development

### Prerequisites
- Node.js (v20+)
- Python (v3.10+)

### 1. Backend Setup
The backend handles data fetching and valid CORS settings.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Running at: `http://localhost:8000`

### 2. Frontend Setup
The frontend communicates with the backend via API.

```bash
cd frontend
npm install
npm run dev
```
Running at: `http://localhost:3000`

### Environment Variables (Optional for Local)
Local development works out-of-the-box with default fallbacks.
- **Backend:** `CORS_ORIGINS` defaults to `http://localhost:3000`.
- **Frontend:** `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000`.

## ☁️ Deployment

This project is optimized for deployment on **Render**.
See [DEPLOY.md](./DEPLOY.md) for a step-by-step guide.

## 📜 License
MIT
