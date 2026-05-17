from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import logging

from app.database import get_db
from app.models.trade import Trade
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trades", tags=["Trades"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class TradeCreate(BaseModel):
    symbol: str
    exchange: str = "NSE"
    trade_type: str  # BUY | SELL
    quantity: int = Field(gt=0)
    entry_price: float = Field(gt=0)
    product_type: str = "INTRADAY"
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    trailing_sl: Optional[float] = None
    strategy_name: Optional[str] = None
    notes: Optional[str] = None
    is_paper_trade: bool = False
    strike_price: Optional[float] = None
    option_type: Optional[str] = None  # CE | PE
    expiry_date: Optional[datetime] = None
    broker_order_id: Optional[str] = None
    broker_name: Optional[str] = None


class TradeUpdate(BaseModel):
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    trailing_sl: Optional[float] = None
    strategy_name: Optional[str] = None


class TradeResponse(BaseModel):
    id: int
    user_id: int
    symbol: str
    exchange: str
    trade_type: str
    quantity: int
    entry_price: float
    exit_price: Optional[float]
    entry_time: datetime
    exit_time: Optional[datetime]
    stop_loss: Optional[float]
    target: Optional[float]
    trailing_sl: Optional[float]
    pnl: Optional[float]
    pnl_percentage: Optional[float]
    net_pnl: Optional[float]
    brokerage: Optional[float]
    status: str
    strategy_name: Optional[str]
    notes: Optional[str]
    is_paper_trade: bool
    product_type: str
    broker_order_id: Optional[str]
    broker_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PnLSummary(BaseModel):
    total_trades: int
    open_trades: int
    closed_trades: int
    winning_trades: int
    losing_trades: int
    total_realized_pnl: float
    total_unrealized_pnl: float
    win_rate: float
    avg_profit: float
    avg_loss: float
    best_trade_pnl: float
    worst_trade_pnl: float
    today_pnl: float


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
async def create_trade(
    payload: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a new trade (manual or broker-synced)."""
    if payload.trade_type.upper() not in ("BUY", "SELL"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="trade_type must be BUY or SELL",
        )

    trade = Trade(
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        exchange=payload.exchange.upper(),
        trade_type=payload.trade_type.upper(),
        quantity=payload.quantity,
        entry_price=payload.entry_price,
        product_type=payload.product_type,
        stop_loss=payload.stop_loss,
        target=payload.target,
        trailing_sl=payload.trailing_sl,
        strategy_name=payload.strategy_name,
        notes=payload.notes,
        is_paper_trade=payload.is_paper_trade,
        strike_price=payload.strike_price,
        option_type=payload.option_type,
        expiry_date=payload.expiry_date,
        broker_order_id=payload.broker_order_id,
        broker_name=payload.broker_name,
        status="OPEN",
        entry_time=datetime.utcnow(),
    )

    db.add(trade)
    await db.commit()
    await db.refresh(trade)
    logger.info(f"Trade created: {trade.id} {trade.symbol} {trade.trade_type}")
    return trade


@router.get("/", response_model=List[TradeResponse])
async def list_trades(
    status_filter: Optional[str] = Query(None, alias="status"),
    symbol: Optional[str] = None,
    is_paper: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all trades for the authenticated user with optional filters."""
    query = select(Trade).where(Trade.user_id == current_user.id)

    if status_filter:
        query = query.where(Trade.status == status_filter.upper())
    if symbol:
        query = query.where(Trade.symbol == symbol.upper())
    if is_paper is not None:
        query = query.where(Trade.is_paper_trade == is_paper)

    query = query.order_by(Trade.entry_time.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/pnl-summary", response_model=PnLSummary)
async def get_pnl_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated P&L summary for the current user."""
    result = await db.execute(
        select(Trade).where(Trade.user_id == current_user.id)
    )
    trades: List[Trade] = result.scalars().all()

    open_trades = [t for t in trades if t.status == "OPEN"]
    closed_trades = [t for t in trades if t.status == "CLOSED"]

    pnls = [t.pnl for t in closed_trades if t.pnl is not None]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]

    today = datetime.utcnow().date()
    today_pnl = sum(
        t.pnl or 0 for t in closed_trades
        if t.exit_time and t.exit_time.date() == today
    )

    return PnLSummary(
        total_trades=len(trades),
        open_trades=len(open_trades),
        closed_trades=len(closed_trades),
        winning_trades=len(wins),
        losing_trades=len(losses),
        total_realized_pnl=round(sum(pnls), 2),
        total_unrealized_pnl=0.0,  # Would need live prices
        win_rate=round(len(wins) / max(len(pnls), 1) * 100, 2),
        avg_profit=round(sum(wins) / max(len(wins), 1), 2),
        avg_loss=round(sum(losses) / max(len(losses), 1), 2),
        best_trade_pnl=round(max(pnls) if pnls else 0, 2),
        worst_trade_pnl=round(min(pnls) if pnls else 0, 2),
        today_pnl=round(today_pnl, 2),
    )


@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific trade by ID."""
    result = await db.execute(
        select(Trade).where(and_(Trade.id == trade_id, Trade.user_id == current_user.id))
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    return trade


@router.patch("/{trade_id}", response_model=TradeResponse)
async def update_trade(
    trade_id: int,
    payload: TradeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a trade (e.g., set exit price to close it)."""
    result = await db.execute(
        select(Trade).where(and_(Trade.id == trade_id, Trade.user_id == current_user.id))
    )
    trade: Optional[Trade] = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    if payload.exit_price is not None:
        trade.exit_price = payload.exit_price
        trade.exit_time = payload.exit_time or datetime.utcnow()
        trade.status = "CLOSED"
        trade.calculate_pnl()

    if payload.status is not None:
        trade.status = payload.status.upper()
    if payload.notes is not None:
        trade.notes = payload.notes
    if payload.stop_loss is not None:
        trade.stop_loss = payload.stop_loss
    if payload.target is not None:
        trade.target = payload.target
    if payload.trailing_sl is not None:
        trade.trailing_sl = payload.trailing_sl
    if payload.strategy_name is not None:
        trade.strategy_name = payload.strategy_name

    await db.commit()
    await db.refresh(trade)
    return trade


@router.delete("/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a trade record."""
    result = await db.execute(
        select(Trade).where(and_(Trade.id == trade_id, Trade.user_id == current_user.id))
    )
    trade = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    await db.delete(trade)
    await db.commit()


@router.post("/{trade_id}/close", response_model=TradeResponse)
async def close_trade(
    trade_id: int,
    exit_price: float = Query(..., description="Exit price to close the trade at"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Quickly close an open trade at given exit price."""
    result = await db.execute(
        select(Trade).where(and_(Trade.id == trade_id, Trade.user_id == current_user.id))
    )
    trade: Optional[Trade] = result.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    if trade.status != "OPEN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trade is not open")

    trade.exit_price = exit_price
    trade.exit_time = datetime.utcnow()
    trade.status = "CLOSED"
    trade.calculate_pnl()

    await db.commit()
    await db.refresh(trade)
    return trade


# ── Paper Trading ─────────────────────────────────────────────────────────

@router.post("/paper/place", response_model=TradeResponse, status_code=status.HTTP_201_CREATED)
async def place_paper_trade(
    payload: TradeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Place a simulated paper trade.
    Uses live market price if entry_price is 0.
    """
    entry_price = payload.entry_price
    if entry_price == 0:
        from app.services.market_data import market_data_service
        quote = await market_data_service.fetch_quote(payload.symbol, payload.exchange)
        entry_price = quote.get("price", 0)
        if entry_price == 0:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to fetch live price for paper trade",
            )

    payload.is_paper_trade = True
    payload.entry_price = entry_price

    trade = Trade(
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        exchange=payload.exchange.upper(),
        trade_type=payload.trade_type.upper(),
        quantity=payload.quantity,
        entry_price=entry_price,
        product_type=payload.product_type,
        stop_loss=payload.stop_loss,
        target=payload.target,
        strategy_name=payload.strategy_name,
        notes=f"[PAPER TRADE] {payload.notes or ''}",
        is_paper_trade=True,
        status="OPEN",
        entry_time=datetime.utcnow(),
    )

    db.add(trade)
    await db.commit()
    await db.refresh(trade)
    return trade
