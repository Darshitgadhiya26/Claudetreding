from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, JSON, Text, Float
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
import enum

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.backtest import BacktestResult


class StrategyType(str, enum.Enum):
    TREND_FOLLOWING = "TREND_FOLLOWING"
    MEAN_REVERSION = "MEAN_REVERSION"
    BREAKOUT = "BREAKOUT"
    MOMENTUM = "MOMENTUM"
    SCALPING = "SCALPING"
    SWING = "SWING"
    OPTIONS = "OPTIONS"
    CUSTOM = "CUSTOM"


class Strategy(Base):
    __tablename__ = "strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    strategy_type: Mapped[str] = mapped_column(String(50), nullable=False, default="CUSTOM")

    # Strategy rules as JSON
    parameters: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {
            "entry_conditions": [],
            "exit_conditions": [],
            "risk_management": {
                "stop_loss_type": "FIXED",
                "stop_loss_value": 1.0,
                "target_type": "FIXED",
                "target_value": 2.0,
                "trailing_sl": False,
                "position_size_type": "FIXED",
                "position_size_value": 1.0,
            },
            "filters": {
                "min_volume": 100000,
                "min_price": 10,
                "max_price": 100000,
                "market_hours_only": True,
            },
            "indicators": [],
            "timeframe": "15m",
            "exchange": "NSE",
        },
    )

    # Optional Python strategy code
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    # Summary updated after backtests
    last_backtest_sharpe: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_backtest_win_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="strategies")
    backtest_results: Mapped[List["BacktestResult"]] = relationship(
        "BacktestResult", back_populates="strategy", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Strategy id={self.id} name={self.name} type={self.strategy_type}>"
