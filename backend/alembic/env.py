"""
Alembic Migration Environment
==============================
Async-compatible environment that imports all models so Alembic can auto-generate
schema diffs against the live database.
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ─────────────────────────────────────────────────────────────────────────────
# Make sure the backend/app package is importable when running alembic from
# the backend/ directory.
# ─────────────────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Import all models so their tables are registered on Base.metadata ─────────
from app.database import Base  # noqa: E402
from app.models import user     # noqa: F401, E402
from app.models import trade    # noqa: F401, E402
from app.models import watchlist  # noqa: F401, E402
from app.models import alert    # noqa: F401, E402

# Optional models — import if they exist
try:
    from app.models import strategy  # noqa: F401
except ImportError:
    pass

try:
    from app.models import backtest  # noqa: F401
except ImportError:
    pass

try:
    from app.models import journal  # noqa: F401
except ImportError:
    pass

# ─────────────────────────────────────────────────────────────────────────────
# Alembic Config object
# ─────────────────────────────────────────────────────────────────────────────
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the sqlalchemy URL from the environment variable
# (falls back to alembic.ini value if DATABASE_URL is not set)
db_url = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))

# asyncpg driver is used for the app; Alembic needs the sync psycopg2 driver
# to run migrations. Convert the URL automatically.
if db_url and db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)

config.set_main_option("sqlalchemy.url", db_url or "")

target_metadata = Base.metadata


# ─────────────────────────────────────────────────────────────────────────────
# Offline migration (no live DB connection)
# ─────────────────────────────────────────────────────────────────────────────

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    Generates SQL scripts without connecting to the database.
    Useful for reviewing migrations before applying them.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ─────────────────────────────────────────────────────────────────────────────
# Online migration (async engine)
# ─────────────────────────────────────────────────────────────────────────────

def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations through a sync connection."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using async SQLAlchemy."""
    asyncio.run(run_async_migrations())


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
