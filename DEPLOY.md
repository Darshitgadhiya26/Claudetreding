# Free Deployment Guide — TradeSense

Deploy the full stack for **$0/month** using:

| Service | Platform | Free Tier |
|---------|----------|-----------|
| Frontend (Next.js) | [Vercel](https://vercel.com) | Unlimited deployments, 100 GB bandwidth |
| Backend (FastAPI) | [Render.com](https://render.com) | 750 hrs/month (spins down after 15 min idle) |
| PostgreSQL | Render.com | 1 GB, included with free web service |
| Redis | [Upstash](https://upstash.com) | 10 000 commands/day, 256 MB |

---

## Step 1 — PostgreSQL on Render

1. Go to [render.com](https://render.com) → **New → PostgreSQL**
2. Name: `tradesense-db` | Plan: **Free**
3. Click **Create Database**
4. Copy the **Internal Database URL** (starts with `postgresql://`)

---

## Step 2 — Redis on Upstash

1. Go to [console.upstash.com](https://console.upstash.com) → **Create Database**
2. Name: `tradesense-redis` | Region: closest to your Render region | **Free plan**
3. Copy the **Redis URL** (starts with `rediss://`)

---

## Step 3 — Backend on Render

### Option A — One-click via render.yaml (recommended)
1. Push this repo to GitHub (if not already)
2. Render Dashboard → **New → Blueprint**
3. Connect your GitHub repo → Render detects `render.yaml` automatically
4. Fill in the **sync: false** env vars in the dashboard:
   - `REDIS_URL` → paste Upstash URL from Step 2
   - `FRONTEND_URL` → you'll fill this after Vercel deploy
5. Click **Apply** — Render builds and deploys the backend + celery worker

### Option B — Manual
1. Render Dashboard → **New → Web Service**
2. Connect repo | Root directory: `backend`
3. Runtime: **Python 3** | Build: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (use `.env.example` as reference):
   - `DATABASE_URL` — from Step 1 (Internal URL)
   - `REDIS_URL` — from Step 2
   - `SECRET_KEY` — click **Generate** in Render
   - `ENVIRONMENT=production`, `DEBUG=false`
6. Click **Create Web Service**

> **Note:** The free Render tier spins down after 15 min of inactivity.
> First request after idle takes ~30 s to wake up. Upgrade to **Starter ($7/mo)**
> to keep it always-on.

---

## Step 4 — Frontend on Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import repo
3. Set **Root Directory** to `frontend`
4. Framework preset: **Next.js** (auto-detected)
5. Add **Environment Variables**:

   | Key | Value |
   |-----|-------|
   | `BACKEND_URL` | `https://<your-render-service>.onrender.com` |
   | `NEXT_PUBLIC_WS_URL` | `wss://<your-render-service>.onrender.com` |
   | `NEXT_PUBLIC_PAPER_TRADING` | `true` |
   | `NEXT_PUBLIC_AI_ASSISTANT` | `true` |

6. Click **Deploy** — Vercel builds and publishes the frontend

7. Copy the Vercel URL (e.g. `https://tradesense.vercel.app`) and set it as
   `FRONTEND_URL` in your Render backend service env vars.

---

## Step 5 — Run Database Migrations

After the backend is live, open the Render **Shell** tab and run:

```bash
cd /app
alembic upgrade head
```

Or add it to the Render build command:
```
pip install -r requirements.txt && alembic upgrade head
```

---

## Step 6 — Verify

| URL | Expected |
|-----|---------|
| `https://tradesense.vercel.app` | Login page |
| `https://<backend>.onrender.com/health` | `{"status":"healthy"}` |
| `https://<backend>.onrender.com/docs` | Swagger UI |

---

## Optional — Add Broker APIs & AI

Set these in the Render dashboard (Environment → Add env var):

```
ANTHROPIC_API_KEY=sk-ant-...      # AI assistant
OPENAI_API_KEY=sk-...             # OpenAI fallback

ZERODHA_API_KEY=...               # Live NSE/BSE data
ZERODHA_API_SECRET=...

TELEGRAM_BOT_TOKEN=...            # Alert notifications
SMTP_USER=...                     # Email alerts
SMTP_PASSWORD=...
```

Without broker keys the app uses **yfinance** as a free fallback for market data.

---

## Custom Domain (optional, free on both platforms)

**Vercel:** Project Settings → Domains → Add your domain → update DNS  
**Render:** Service Settings → Custom Domains → Add domain → update DNS

---

## Architecture Diagram

```
Browser
  │
  ├─ HTTPS ──► Vercel (Next.js)
  │               │ /api/* rewrites (server-side proxy)
  │               ▼
  │          Render.com (FastAPI :$PORT)
  │               │
  │               ├──► Render PostgreSQL
  │               ├──► Upstash Redis
  │               └──► yfinance / Broker APIs
  │
  └─ WSS ───► Render.com /ws  (live price feed)
```

The Next.js rewrite proxies all `/api/*` calls server-side, so **no CORS
headers are needed** and the backend URL is never exposed to the browser.
