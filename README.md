# Roster Riddle

Roster Riddle is a daily pro football player guessing game built with a Next.js frontend and a FastAPI backend.

## What Changed

- Rebranded the app away from league-and-publisher-specific naming.
- Removed player headshot rendering and cached headshot URLs from the shipped dataset.
- Added persistent daily progress, local streak/history tracking, and spoiler-free result sharing.
- Added launch basics: health endpoint, lightweight event logging, privacy page, terms page, manifest, robots, sitemap, and social preview metadata.
- Hardened runtime assumptions with timezone-based daily selection, Node version pinning, and a backend dependency fix.

## Stack

- Frontend: Next.js 16, React 19, Tailwind CSS 4
- Backend: FastAPI, Python 3.11, `nfl_data_py`, pandas
- Puzzle timezone: `America/New_York`

## Local Development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

Use Node `20.18.0` or newer.

```bash
cd frontend
npm install
npm run dev
```

## Required Environment Variables

### Backend

- `CORS_ORIGINS`: comma-separated allowed origins
- `PUZZLE_TIMEZONE`: optional, defaults to `America/New_York`

### Frontend

- `NEXT_PUBLIC_API_URL`: backend base URL, no trailing slash
- `NEXT_PUBLIC_SITE_URL`: public site URL for metadata, sitemap, and sharing

## Health And Events

- `GET /api/health`: service health, player count, and current puzzle date
- `POST /api/events`: lightweight anonymous product events

## Notes

- This project is structured more like a launchable product than a prototype now, but it is still an unofficial sports game and should be reviewed for branding, data rights, and monetization risk before a real commercial push.

## License

MIT
