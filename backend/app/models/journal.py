from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, JSON, Text, Float
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, TYPE_CHECKING
import enum

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.trade import Trade


class MoodType(str, enum.Enum):
    VERY_CONFIDENT = "VERY_CONFIDENT"
    CONFIDENT = "CONFIDENT"
    NEUTRAL = "NEUTRAL"
    NERVOUS = "NERVOUS"
    FEARFUL = "FEARFUL"
    GREEDY = "GREEDY"
    FOMO = "FOMO"
    REVENGE = "REVENGE"


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    trade_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trades.id"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lessons_learned: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Psychology tracking
    psychology_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-10
    mood: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Mistake classification
    mistake_tags: Mapped[Optional[list]] = mapped_column(
        JSON,
        nullable=True,
        default=list,
    )
    # Example tags: ["early_exit", "late_entry", "revenge_trade", "fomo", "no_stop_loss",
    #               "overtrading", "undersized", "oversized"]

    # Market context at time of trade
    market_context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Setup quality rating (1-5 stars)
    setup_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Execution quality rating (1-5)
    execution_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Screenshots / chart images
    screenshot_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    chart_annotations: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # For generic journal entries (not linked to a trade)
    is_daily_review: Mapped[bool] = mapped_column(Boolean, default=False)
    market_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    planned_trades: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="journal_entries")
    trade: Mapped[Optional["Trade"]] = relationship("Trade", back_populates="journal_entry")

    def __repr__(self) -> str:
        return f"<JournalEntry id={self.id} title={self.title[:30]} user_id={self.user_id}>"
