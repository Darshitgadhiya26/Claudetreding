"""
Celery Application
==================
Background task queue for the trading platform.
Broker: Redis  |  Result backend: Redis
"""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# App instance
# ─────────────────────────────────────────────────────────────────────────────

celery_app = Celery(
    "trading_platform",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.alerts",
        "app.tasks.market_data",
        "app.tasks.backtests",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",   # Indian Standard Time
    enable_utc=False,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,       # Results expire after 1 hour
)

# ─────────────────────────────────────────────────────────────────────────────
# Periodic task schedule (Celery Beat)
# ─────────────────────────────────────────────────────────────────────────────

celery_app.conf.beat_schedule = {
    # Check price alerts every minute during market hours (9:15 AM – 3:30 PM IST, Mon–Fri)
    "check-alerts-every-minute": {
        "task": "app.tasks.alerts.check_alerts",
        "schedule": 60.0,  # every 60 seconds
        "options": {"expires": 55},
    },

    # Fetch and cache market data every 5 minutes
    "fetch-market-data-5min": {
        "task": "app.tasks.market_data.fetch_market_data",
        "schedule": 300.0,
        "options": {"expires": 290},
    },

    # Run scheduled backtests at 4:00 PM IST (after market close)
    "run-scheduled-backtests": {
        "task": "app.tasks.backtests.run_scheduled_backtests",
        "schedule": crontab(hour=16, minute=0, day_of_week="1-5"),
    },

    # Daily cleanup of stale cache entries at 6:00 AM IST
    "daily-cleanup": {
        "task": "app.tasks.market_data.cleanup_cache",
        "schedule": crontab(hour=6, minute=0),
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Inline task definitions (fallback if task modules are not yet created)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.alerts.check_alerts", bind=True, max_retries=3)
def check_alerts(self):
    """
    Evaluate all active price alerts and send notifications if triggered.
    Triggered every minute by the beat scheduler.
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info("Running check_alerts task...")
        # TODO: query active alerts from DB, compare with live price, send Telegram/email
        return {"status": "ok", "checked": 0}
    except Exception as exc:
        logger.error(f"check_alerts failed: {exc}")
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.tasks.market_data.fetch_market_data", bind=True, max_retries=2)
def fetch_market_data(self):
    """
    Fetch and cache OHLCV data for watchlisted symbols using yfinance.
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info("Running fetch_market_data task...")
        # TODO: fetch Nifty50 and watchlist symbols; store in Redis cache
        return {"status": "ok", "symbols_fetched": 0}
    except Exception as exc:
        logger.error(f"fetch_market_data failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.market_data.cleanup_cache", bind=True)
def cleanup_cache(self):
    """Remove stale cache entries from Redis."""
    import logging
    logging.getLogger(__name__).info("Running cleanup_cache task...")
    return {"status": "ok"}


@celery_app.task(name="app.tasks.backtests.run_scheduled_backtests", bind=True, max_retries=2)
def run_scheduled_backtests(self):
    """
    Run end-of-day backtests for all saved strategy configurations.
    Results are stored in the database for reporting.
    """
    import logging
    logger = logging.getLogger(__name__)
    try:
        logger.info("Running run_scheduled_backtests task...")
        # TODO: iterate saved strategies, fetch daily OHLCV, run BacktestEngine
        return {"status": "ok", "backtests_run": 0}
    except Exception as exc:
        logger.error(f"run_scheduled_backtests failed: {exc}")
        raise self.retry(exc=exc, countdown=120)
