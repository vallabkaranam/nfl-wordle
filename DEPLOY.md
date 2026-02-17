# Deployment Guide (Render)

This project is separated into two services: `frontend` (Next.js) and `backend` (FastAPI). Before deploying, ensure you have forked or pushed this repository to GitHub.
If data fails to load initially, simply **refresh the page** after ~30 seconds.

## 1. Deploy the Backend (FastAPI)

1.  Log in to [Render](https://render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  Configure the service as follows:
    *   **Name:** `nfl-wordle-backend` (or similar)
    *   **Root Directory:** `backend`
    *   **Runtime:** Python 3
    *   **Build Command:** `pip install -r requirements.txt`
    *   **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
    *   **Instance Type:** Free (or Starter if needed)
5.  **Environment Variables:**
    *   `CORS_ORIGINS`: Set this to the URL of your frontend once deployed (e.g., `https://nfl-wordle.onrender.com`). During setup, you can leave it temporarily blank or use `*` (not recommended for prod) or `http://localhost:3000`. Ideally, deploy frontend first or come back to update this.
    *   `PYTHON_VERSION`: `3.11.0` (Recommended)

Once deployed, copy the **onrender.com URL** (e.g., `https://nfl-wordle-backend.onrender.com`). You will need this for the frontend.

## 2. Deploy the Frontend (Next.js)

1.  Click **New +** -> **Web Service**.
2.  Connect the same GitHub repository.
3.  Configure the service as follows:
    *   **Name:** `nfl-wordle-frontend` (or similar)
    *   **Root Directory:** `frontend`
    *   **Runtime:** Node
    *   **Build Command:** `npm install && npm run build`
    *   **Start Command:** `npm start`
    *   **Instance Type:** Free
4.  **Environment Variables:**
    *   `NEXT_PUBLIC_API_URL`: Paste your backend URL here (e.g., `https://nfl-wordle-backend.onrender.com`). **Do not add a trailing slash.**

## 3. Finalize Configuration

1.  Go back to your **Backend Service** dashboard.
2.  Update the `CORS_ORIGINS` environment variable to match your new **Frontend URL** (e.g., `https://nfl-wordle-frontend.onrender.com`).
3.  Save changes. The backend will redeploy automatically.

## Notes & Cold Start

- **Data Loading:** The backend fetches NFL roster data on startup. The first deployment may take ~10-30 seconds to become healthy as it downloads and processes data. 
- **Free Tier Limits:** Render Free Tier spins down inactive services after 15 minutes. It will spin up again on the next request, but the first request may take up to 30-50 seconds (boot + data fetch).
- **Hard Refresh:** If you don't see data immediately, refresh the page.
