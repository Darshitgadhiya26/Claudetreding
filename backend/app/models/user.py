from sqlalchemy import String, Boolean, DateTime, JSON, Integer
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from app.database import Base

if TYPE_CHECKING:
    from app.models.trade import Trade
    from app.models.watchlist import Watchlist
    from app.models.alert import Alert
    from app.models.strategy import Strategy
    from app.models.journal import JournalEntry


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Broker credentials stored as JSON (encrypted in production)
    broker_credentials: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    # User preferences (theme, notifications, default exchange, etc.)
    preferences: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
        default=lambda: {
            "theme": "dark",
            "default_exchange": "NSE",
            "default_timeframe": "15m",
            "notifications": {
                "telegram": False,
                "email": False,
                "browser": True,
            },
            "risk_per_trade_percent": 1.0,
            "default_capital": 100000,
        },
    )

    # Telegram chat ID for notifications
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Profile
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    trades: Mapped[List["Trade"]] = relationship("Trade", back_populates="user", lazy="select")
    watchlists: Mapped[List["Watchlist"]] = relationship(
        "Watchlist", back_populates="user", lazy="select"
    )
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="user", lazy="select")
    strategies: Mapped[List["Strategy"]] = relationship(
        "Strategy", back_populates="user", lazy="select"
    )
    journal_entries: Mapped[List["JournalEntry"]] = relationship(
        "JournalEntry", back_populates="user", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
