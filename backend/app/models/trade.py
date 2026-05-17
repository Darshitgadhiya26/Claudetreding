from sqlalchemy import String, Boolean, DateTime, Float, Integer, ForeignKey, Text, Enum
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, TYPE_CHECKING
import enum

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.journal import JournalEntry


class TradeType(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class TradeStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"


class Exchange(str, enum.Enum):
    NSE = "NSE"
    BSE = "BSE"
    NFO = "NFO"
    BFO = "BFO"
    MCX = "MCX"
    CDS = "CDS"


class ProductType(str, enum.Enum):
    INTRADAY = "INTRADAY"
    DELIVERY = "DELIVERY"
    FUTURES = "FUTURES"
    OPTIONS = "OPTIONS"


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Instrument details
    symbol: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    exchange: Mapped[str] = mapped_column(String(10), nullable=False, default="NSE")
    product_type: Mapped[str] = mapped_column(String(20), default="INTRADAY")

    # Options specific
    strike_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    option_type: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)  # CE / PE
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Trade details
    trade_type: Mapped[str] = mapped_column(String(4), nullable=False)  # BUY / SELL
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Risk management
    stop_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    target: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trailing_sl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # P&L
    pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pnl_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    brokerage: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.0)
    taxes: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.0)
    net_pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    entry_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    exit_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Status & metadata
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    strategy_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_paper_trade: Mapped[bool] = mapped_column(Boolean, default=False)

    # Broker order IDs
    broker_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    broker_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="trades")
    journal_entry: Mapped[Optional["JournalEntry"]] = relationship(
        "JournalEntry", back_populates="trade", uselist=False
    )

    def calculate_pnl(self) -> Optional[float]:
        """Calculate P&L when trade is closed."""
        if self.exit_price is None:
            return None
        multiplier = 1 if self.trade_type == "BUY" else -1
        gross_pnl = multiplier * (self.exit_price - self.entry_price) * self.quantity
        brokerage = self.brokerage or 0.0
        taxes = self.taxes or 0.0
        self.pnl = gross_pnl
        self.net_pnl = gross_pnl - brokerage - taxes
        if self.entry_price and self.quantity:
            self.pnl_percentage = (gross_pnl / (self.entry_price * self.quantity)) * 100
        return self.net_pnl

    def __repr__(self) -> str:
        return f"<Trade id={self.id} symbol={self.symbol} type={self.trade_type} status={self.status}>"
