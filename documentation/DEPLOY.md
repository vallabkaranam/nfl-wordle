# Deployment Guide

This project runs as two services:

- `frontend`: Next.js app
- `backend`: FastAPI API

## Backend

1. Deploy the `backend` directory as a Python web service.
2. Install from `requirements.txt`.
3. Start with:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Set these environment variables:

- `CORS_ORIGINS=https://your-frontend-domain.com`
- `PUZZLE_TIMEZONE=America/New_York`
- `PYTHON_VERSION=3.11.0`

After deploy, verify:

- `GET /api/health` returns `status`, `player_count`, and `puzzle_date`

## Frontend

1. Deploy the `frontend` directory as a Node service.
2. Use Node `20.18.0` or newer.
3. Build and start with:

```bash
npm install && npm run build
npm start
```

Set these environment variables:

- `NEXT_PUBLIC_API_URL=https://your-backend-domain.com`
- `NEXT_PUBLIC_SITE_URL=https://your-frontend-domain.com`

## Launch Checklist

- Backend `/api/health` is green
- Frontend can load `/`, `/privacy`, and `/terms`
- `NEXT_PUBLIC_SITE_URL` is set so metadata, sitemap, and share links are correct
- `CORS_ORIGINS` matches the frontend domain exactly
- First-load latency is acceptable on your chosen hosting tier
- Event logging is acceptable for your privacy posture before promotion
