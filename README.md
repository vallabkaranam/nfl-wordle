# NFL Wordle

A daily NFL player guessing game built with Next.js (Frontend) and FastAPI (Backend).

## Quick Start (Local Development)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Server runs at: `http://localhost:8000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at: `http://localhost:3000`

## Deployment

This project involves two separate services. See [DEPLOY.md](./DEPLOY.md) for detailed instructions on deploying to Render.
