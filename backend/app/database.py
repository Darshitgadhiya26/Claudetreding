from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from typing import AsyncGenerator, Optional
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


# ── Lazy engine initialisation ─────────────────────────────────────────────────
# Engine is created on first use rather than at import time so that importing
# app modules (for testing, type-checking, etc.) doesn't require asyncpg / a
# live database connection.

_engine = None
_AsyncSessionLocal = None


def _get_engine():
    """Return (and lazily create) the global async SQLAlchemy engine."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            pool_timeout=30,
            pool_recycle=1800,
        )
    return _engine


def _get_session_factory():
    """Return (and lazily create) the global async session factory."""
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            bind=_get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _AsyncSessionLocal


# Convenience aliases (compatible with existing code that references these names)
@property
def engine():
    return _get_engine()


# Make AsyncSessionLocal available as a module-level callable
class _SessionLocalProxy:
    """Proxy that behaves like async_sessionmaker but initialises lazily."""
    def __call__(self, *args, **kwargs):
        return _get_session_factory()(*args, **kwargs)

    def __call__(self):  # noqa: F811
        return _get_session_factory()()


AsyncSessionLocal = _get_session_factory  # callable that returns the factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield an async database session per request."""
    factory = _get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create all database tables on startup."""
    from app.models import user, trade, watchlist, alert, strategy, backtest, journal  # noqa: F401
    async with _get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully.")


async def drop_tables() -> None:
    """Drop all database tables — use with caution."""
    async with _get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    logger.warning("All database tables dropped.")


async def check_db_connection() -> bool:
    """Return True if the database can be reached, False otherwise."""
    try:
        async with _get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False
