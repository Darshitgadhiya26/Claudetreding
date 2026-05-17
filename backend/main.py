"""
Indian Stock Market Trading Platform — FastAPI Backend
======================================================
Entry point for the production-ready backend server.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import create_tables, check_db_connection
from app.websocket.manager import manager

# ── Logging setup ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")

# ── Track startup time ─────────────────────────────────────────────────────────
_START_TIME = time.time()


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialise resources on startup, clean up on shutdown."""
    logger.info("=" * 60)
    logger.info("  Indian Stock Market Trading Platform starting up")
    logger.info(f"  Environment : {settings.ENVIRONMENT}")
    logger.info(f"  Debug       : {settings.DEBUG}")
    logger.info("=" * 60)

    # Create database tables
    try:
        await create_tables()
        logger.info("Database tables ready.")
    except Exception as e:
        logger.error(f"Database initialisation failed: {e}")
        # Don't crash — allow app to start for health checks

    # Check DB connectivity
    db_healthy = await check_db_connection()
    logger.info(f"Database health: {'OK' if db_healthy else 'UNAVAILABLE'}")

    # Start background alert checker (every 30 seconds)
    alert_task = asyncio.create_task(_alert_checker_loop())

    logger.info("Server ready. Waiting for requests...")
    yield  # Application runs here

    # ── Shutdown ──
    logger.info("Shutting down...")
    alert_task.cancel()
    try:
        await alert_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutdown complete.")


async def _alert_checker_loop():
    """Background task: check active alerts against live prices every 30s."""
    from app.database import AsyncSessionLocal
    from app.services.alert_service import alert_service

    while True:
        try:
            await asyncio.sleep(30)
            async with AsyncSessionLocal() as db:
                triggered = await alert_service.check_alert_conditions(db)
                if triggered:
                    logger.info(f"Triggered {len(triggered)} alert(s)")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Alert checker error: {e}")


# ── App instance ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Production-ready REST + WebSocket API for Indian stock market trading. "
        "Supports NSE/BSE equity, F&O, technical analysis, backtesting, and AI insights."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────────────────────

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip compression for large payloads (e.g. option chains, equity curves)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Process-Time"] = f"{duration:.4f}s"
    return response


# ── Global exception handler ───────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "path": str(request.url),
        },
    )


# ── Include routers ────────────────────────────────────────────────────────────

from app.routers import auth, market, trades, strategies, backtesting, alerts, ai_assistant, options, admin

app.include_router(auth.router)
app.include_router(market.router)
app.include_router(trades.router)
app.include_router(strategies.router)
app.include_router(backtesting.router)
app.include_router(alerts.router)
app.include_router(ai_assistant.router)
app.include_router(options.router)
app.include_router(admin.router)


# ── WebSocket endpoint ─────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint.

    Supports anonymous connections for market data.
    Authenticated users can subscribe to private channels (alerts, order updates).

    Client message protocol:
        { "type": "subscribe", "symbols": ["RELIANCE", "TCS"] }
        { "type": "unsubscribe", "symbols": ["TCS"] }
        { "type": "ping" }
    """
    user_id: Optional[int] = None
    client_id = websocket.query_params.get("client_id")
    token = websocket.query_params.get("token")

    # Optional auth via query param token
    if token:
        try:
            from app.utils.auth import get_user_id_from_token
            user_id = get_user_id_from_token(token)
        except Exception:
            pass  # Proceed as anonymous

    await manager.connect(websocket, user_id=user_id, client_id=client_id)
    logger.info(f"WS connected: user_id={user_id} client_id={client_id}")

    try:
        while True:
            raw_message = await websocket.receive_text()
            await manager.handle_client_message(websocket, raw_message)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WS disconnected: user_id={user_id}")
    except Exception as e:
        logger.error(f"WS error (user_id={user_id}): {e}")
        manager.disconnect(websocket)


@app.websocket("/ws/market")
async def websocket_market(websocket: WebSocket):
    """
    Dedicated market data WebSocket.
    Streams real-time price updates for subscribed symbols.
    """
    await manager.connect(websocket, client_id="market_stream")
    try:
        while True:
            raw = await websocket.receive_text()
            await manager.handle_client_message(websocket, raw)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── REST health + root ─────────────────────────────────────────────────────────

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint — returns API info."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "redoc": "/redoc",
        "websocket": "/ws",
        "health": "/health",
        "uptime_seconds": round(time.time() - _START_TIME, 1),
    }


@app.get("/health", tags=["Root"])
async def health():
    """Public health check endpoint."""
    db_ok = await check_db_connection()
    ws_stats = manager.get_stats()

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "websocket_connections": ws_stats["total_connections"],
        "uptime_seconds": round(time.time() - _START_TIME, 1),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/market-status", tags=["Root"])
async def market_status():
    """Return current NSE market open/close status."""
    from app.utils.helpers import get_market_status
    return get_market_status()


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else 4,
        log_level="debug" if settings.DEBUG else "info",
        ws_ping_interval=20,
        ws_ping_timeout=10,
    )
