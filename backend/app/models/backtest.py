from sqlalchemy import String, DateTime, Float, Integer, ForeignKey, JSON, Text
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.sql import func
from datetime import datetime, date
from typing import Optional, TYPE_CHECKING

from app.database import Base

if TYPE_CHECKING:
    from app.models.strategy import Strategy


class BacktestResult(Base):
    __tablename__ = "backtest_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    strategy_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("strategies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # Backtest parameters
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    exchange: Mapped[str] = mapped_column(String(10), nullable=False, default="NSE")
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False, default="15m")
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    initial_capital: Mapped[float] = mapped_column(Float, nullable=False, default=100000.0)

    # Trade statistics
    total_trades: Mapped[int] = mapped_column(Integer, default=0)
    winning_trades: Mapped[int] = mapped_column(Integer, default=0)
    losing_trades: Mapped[int] = mapped_column(Integer, default=0)
    breakeven_trades: Mapped[int] = mapped_column(Integer, default=0)

    # P&L metrics
    total_pnl: Mapped[float] = mapped_column(Float, default=0.0)
    total_pnl_percent: Mapped[float] = mapped_column(Float, default=0.0)
    gross_profit: Mapped[float] = mapped_column(Float, default=0.0)
    gross_loss: Mapped[float] = mapped_column(Float, default=0.0)
    avg_profit_per_trade: Mapped[float] = mapped_column(Float, default=0.0)
    avg_loss_per_trade: Mapped[float] = mapped_column(Float, default=0.0)
    largest_win: Mapped[float] = mapped_column(Float, default=0.0)
    largest_loss: Mapped[float] = mapped_column(Float, default=0.0)
    avg_trade_duration_minutes: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Risk metrics
    max_drawdown: Mapped[float] = mapped_column(Float, default=0.0)
    max_drawdown_percent: Mapped[float] = mapped_column(Float, default=0.0)
    sharpe_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sortino_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calmar_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Performance metrics
    win_rate: Mapped[float] = mapped_column(Float, default=0.0)
    profit_factor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cagr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expectancy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    final_capital: Mapped[float] = mapped_column(Float, default=0.0)

    # Detailed results stored as JSON
    equity_curve: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    trade_log: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    monthly_returns: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED")
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    strategy: Mapped["Strategy"] = relationship("Strategy", back_populates="backtest_results")

    def __repr__(self) -> str:
        return (
            f"<BacktestResult id={self.id} strategy_id={self.strategy_id} "
            f"symbol={self.symbol} win_rate={self.win_rate:.1f}%>"
        )
