# Indian Stock Market Trading Platform

A full-stack algorithmic trading platform for NSE/BSE markets, featuring real-time data, multi-strategy backtesting, AI-powered analysis, and broker integrations.

---

## Feature Overview

| Feature | Details |
|---|---|
| Market Data | Live NSE/BSE quotes via yfinance (RELIANCE.NS, ^NSEI format) |
| Strategies | VWAP Breakout, EMA Crossover, RSI Reversal, Supertrend, Breakout, Option Buyer/Seller |
| Backtesting | Candle-by-candle simulation with SL/Target/Trailing SL, Sharpe, CAGR, Max Drawdown |
| Technical Indicators | RSI, MACD, EMA, SMA, VWAP, ATR, Supertrend, Bollinger Bands, ADX, Ichimoku, Volume Profile |
| Pattern Detection | Doji, Hammer, Engulfing, Double Top/Bottom, Head & Shoulders, Bull Flag, Cup & Handle |
| AI Assistant | Claude (Anthropic) + GPT-4o (OpenAI) – trade ideas, risk analysis, option chain, sentiment |
| Broker Integrations | Zerodha Kite Connect, Upstox, Angel One SmartAPI |
| Notifications | Telegram bot + Email (SMTP) |
| Background Tasks | Celery + Redis – alert checks, data fetch, scheduled backtests |
| Database | PostgreSQL 16 with async SQLAlchemy + Alembic migrations |
| Frontend | Next.js 14, TailwindCSS, TradingView lightweight-charts |
| Deployment | Docker Compose (all services) |

---

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2
- **Git**
- (Optional, for development without Docker)
  - Python 3.11+
  - Node.js 20+

---

## Quick Start with Docker

### 1. Clone the repository

```bash
git clone <repo-url>
cd Claudetreding
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- Database password (`POSTGRES_PASSWORD`)
- JWT secret (`SECRET_KEY`) — use `openssl rand -hex 32`
- AI keys (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)
- Broker credentials (optional)

### 3. Start all services

```bash
docker-compose up -d
```

This starts: PostgreSQL, Redis, FastAPI backend, Next.js frontend, Celery worker, and Celery beat scheduler.

### 4. Run database migrations

```bash
docker-compose exec backend alembic upgrade head
```

### 5. Access the application

| Service | URL |
|---|---|
| Frontend (trading UI) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Documentation (Swagger) | http://localhost:8000/docs |
| API Documentation (ReDoc) | http://localhost:8000/redoc |
| Celery Flower (monitoring) | http://localhost:5555 (run with `--profile monitoring`) |

### 6. Stop services

```bash
docker-compose down          # Stop and remove containers
docker-compose down -v       # Also remove volumes (wipes database!)
```

---

## Development Setup (Without Docker)

### Backend

```bash
cd backend

# Create and activate virtual environment
python3.11 -m venv venv
source venv/bin/activate       # Linux/macOS
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env           # Edit with your local DB settings

# Start PostgreSQL and Redis locally (or use Docker for just those)
docker-compose up postgres redis -d

# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Celery Worker (separate terminal)

```bash
cd backend
source venv/bin/activate
celery -A app.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local     # Edit NEXT_PUBLIC_API_URL if needed

# Start development server
npm run dev
```

The frontend will be available at http://localhost:3000.

---

## API Documentation

The FastAPI backend provides automatic interactive documentation:

- **Swagger UI**: http://localhost:8000/docs — try all endpoints in the browser
- **ReDoc**: http://localhost:8000/redoc — clean reference documentation

### Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/market/indices` | Nifty50, BankNifty, Sensex live data |
| GET | `/api/market/candles/{symbol}` | OHLCV candles (timeframe + limit params) |
| GET | `/api/market/quote/{symbol}` | Real-time quote for any NSE symbol |
| GET | `/api/market/top-gainers` | Top gainers from Nifty50 universe |
| GET | `/api/market/top-losers` | Top losers from Nifty50 universe |
| GET | `/api/market/search?q=reliance` | Search symbols by name or ticker |
| GET | `/api/market/breadth` | Market breadth (advances/declines) |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/trades` | User's trade history |
| POST | `/api/backtests/run` | Run a backtest |
| POST | `/api/ai/chat` | Chat with AI assistant |

---

## Adding Broker Credentials

### Zerodha Kite Connect

1. Register at https://developers.kite.trade/
2. Create an app and get `API_KEY` and `API_SECRET`
3. Add to `.env`: `ZERODHA_API_KEY`, `ZERODHA_API_SECRET`
4. Complete daily OAuth flow to get `ZERODHA_ACCESS_TOKEN`

### Upstox

1. Register at https://developer.upstox.com/
2. Create an app — set redirect URI to `http://localhost:8000/auth/upstox/callback`
3. Add to `.env`: `UPSTOX_API_KEY`, `UPSTOX_API_SECRET`

### Angel One SmartAPI

1. Register at https://smartapi.angelbroking.com/
2. Add to `.env`: `ANGEL_API_KEY`, `ANGEL_CLIENT_ID`, `ANGEL_PASSWORD`, `ANGEL_TOTP`
3. `ANGEL_TOTP` is the base32 secret from your authenticator app setup

---

## Running Backtests

### Via API

```bash
curl -X POST http://localhost:8000/api/backtests/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "RELIANCE.NS",
    "strategy": "ema_crossover",
    "params": {"fast_period": 9, "slow_period": 21},
    "timeframe": "1d",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "initial_capital": 100000,
    "sl_percent": 1.5,
    "target_percent": 3.0,
    "trailing_sl": true
  }'
```

### Via Python

```python
import yfinance as yf
from app.strategies.ema_crossover import EMACrossoverStrategy
from app.backtesting.engine import BacktestEngine

data = yf.download("RELIANCE.NS", period="1y", interval="1d")
data.columns = [c.lower() for c in data.columns]

strategy = EMACrossoverStrategy({"fast_period": 9, "slow_period": 21})
engine = BacktestEngine(initial_capital=100000)
result = engine.run(strategy, data, sl_percent=1.5, target_percent=3.0, trailing_sl=True)

print(result.to_dict())
```

---

## Available Strategies

| Strategy | File | Parameters |
|---|---|---|
| VWAP Breakout | `strategies/vwap_breakout.py` | `volume_multiplier`, `sl_percent` |
| EMA Crossover | `strategies/ema_crossover.py` | `fast_period`, `slow_period` |
| RSI Reversal | `strategies/rsi_reversal.py` | `rsi_period`, `oversold`, `overbought` |
| Supertrend | `strategies/supertrend.py` | `period`, `multiplier` |
| Breakout | `strategies/breakout.py` | `lookback`, `confirmation_candles` |
| Option Buyer | `strategies/option_buyer.py` | `fast_ema`, `slow_ema`, `rsi_period`, `profit_target`, `stop_loss` |
| Option Seller | `strategies/option_seller.py` | `wing_width`, `profit_target_pct`, `max_loss_multiplier` |

To add a custom strategy, subclass `BaseStrategy` in `backend/app/strategies/base.py` and implement `generate_signals()`.

---

## Telegram Notifications

1. Create a bot via @BotFather on Telegram
2. Add `TELEGRAM_BOT_TOKEN` to `.env`
3. Alerts for price levels, strategy signals, and backtest completion are sent automatically

---

## Project Structure

```
Claudetreding/
├── backend/
│   ├── app/
│   │   ├── ai/              # AI assistant (Anthropic + OpenAI)
│   │   ├── backtesting/     # BacktestEngine
│   │   ├── broker_integrations/
│   │   ├── indicators/      # Technical indicators
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── services/        # Business logic
│   │   ├── strategies/      # Trading strategy implementations
│   │   ├── celery_app.py    # Background task queue
│   │   ├── config.py        # Settings (pydantic-settings)
│   │   └── database.py      # Async SQLAlchemy engine
│   ├── alembic/             # Database migrations
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```
