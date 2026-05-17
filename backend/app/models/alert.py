from sqlalchemy import String, Boolean, DateTime, Float, Integer, ForeignKey, JSON, Text
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, TYPE_CHECKING
import enum

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class AlertConditionType(str, enum.Enum):
    PRICE_ABOVE = "PRICE_ABOVE"
    PRICE_BELOW = "PRICE_BELOW"
    PRICE_CROSSES = "PRICE_CROSSES"
    PERCENT_CHANGE_UP = "PERCENT_CHANGE_UP"
    PERCENT_CHANGE_DOWN = "PERCENT_CHANGE_DOWN"
    RSI_ABOVE = "RSI_ABOVE"
    RSI_BELOW = "RSI_BELOW"
    RSI_OVERBOUGHT = "RSI_OVERBOUGHT"
    RSI_OVERSOLD = "RSI_OVERSOLD"
    MACD_CROSSOVER_BULLISH = "MACD_CROSSOVER_BULLISH"
    MACD_CROSSOVER_BEARISH = "MACD_CROSSOVER_BEARISH"
    EMA_CROSSOVER = "EMA_CROSSOVER"
    VOLUME_SPIKE = "VOLUME_SPIKE"
    BOLLINGER_UPPER = "BOLLINGER_UPPER"
    BOLLINGER_LOWER = "BOLLINGER_LOWER"
    SUPERTREND_BUY = "SUPERTREND_BUY"
    SUPERTREND_SELL = "SUPERTREND_SELL"


class AlertFrequency(str, enum.Enum):
    ONCE = "ONCE"
    EVERY_TIME = "EVERY_TIME"
    DAILY = "DAILY"


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Instrument
    symbol: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    exchange: Mapped[str] = mapped_column(String(10), nullable=False, default="NSE")

    # Alert condition
    condition_type: Mapped[str] = mapped_column(String(50), nullable=False)
    condition_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    condition_params: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Alert config
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    frequency: Mapped[str] = mapped_column(String(20), default="ONCE")

    # Notification channels
    notification_channels: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"telegram": False, "email": False, "browser": True},
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    triggered_count: Mapped[int] = mapped_column(Integer, default=0)
    triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timeframe for indicator-based alerts
    timeframe: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="15m")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="alerts")

    def __repr__(self) -> str:
        return (
            f"<Alert id={self.id} symbol={self.symbol} condition={self.condition_type} "
            f"active={self.is_active}>"
        )
