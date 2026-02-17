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
- **Backend:** FastAPI (Python 3.11), `nfl_data_py` for data sourcing.
- **Data:** Live roster data fetched from `nfl_data_py` (Github) and cached locally for performance.

## ☁️ Daily Game
**Play Now:** [https://nfl-wordle-frontend.onrender.com](https://nfl-wordle-frontend.onrender.com)

## 📜 License
MIT
