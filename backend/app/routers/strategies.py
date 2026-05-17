from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import logging

from app.database import get_db
from app.models.strategy import Strategy
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/strategies", tags=["Strategies"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class StrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    strategy_type: str = "CUSTOM"
    parameters: Optional[dict] = None
    code: Optional[str] = None
    is_active: bool = True
    is_public: bool = False


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    strategy_type: Optional[str] = None
    parameters: Optional[dict] = None
    code: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None


class StrategyResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    strategy_type: str
    parameters: dict
    code: Optional[str]
    is_active: bool
    is_public: bool
    last_backtest_sharpe: Optional[float]
    last_backtest_win_rate: Optional[float]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RunStrategyRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"
    timeframe: str = "15m"
    live: bool = False  # If True, generate signals on live data


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/", response_model=StrategyResponse, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    payload: StrategyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new trading strategy."""
    strategy = Strategy(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        strategy_type=payload.strategy_type.upper(),
        parameters=payload.parameters or {},
        code=payload.code,
        is_active=payload.is_active,
        is_public=payload.is_public,
    )
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return strategy


@router.get("/", response_model=List[StrategyResponse])
async def list_strategies(
    include_public: bool = Query(False),
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all strategies (own + optionally public ones)."""
    query = select(Strategy).where(Strategy.user_id == current_user.id)

    if is_active is not None:
        query = query.where(Strategy.is_active == is_active)

    result = await db.execute(query.order_by(Strategy.created_at.desc()))
    strategies = list(result.scalars().all())

    if include_public:
        pub_result = await db.execute(
            select(Strategy).where(
                and_(Strategy.is_public == True, Strategy.user_id != current_user.id)
            )
        )
        strategies.extend(pub_result.scalars().all())

    return strategies


@router.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(
    strategy_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific strategy by ID."""
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id)
    )
    strategy: Optional[Strategy] = result.scalar_one_or_none()

    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    # Allow access if own strategy or public
    if strategy.user_id != current_user.id and not strategy.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    return strategy


@router.patch("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: int,
    payload: StrategyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a strategy."""
    result = await db.execute(
        select(Strategy).where(
            and_(Strategy.id == strategy_id, Strategy.user_id == current_user.id)
        )
    )
    strategy: Optional[Strategy] = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(strategy, field, value)

    await db.commit()
    await db.refresh(strategy)
    return strategy


@router.delete("/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_strategy(
    strategy_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a strategy and all its backtest results."""
    result = await db.execute(
        select(Strategy).where(
            and_(Strategy.id == strategy_id, Strategy.user_id == current_user.id)
        )
    )
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    await db.delete(strategy)
    await db.commit()


@router.post("/{strategy_id}/run")
async def run_strategy(
    strategy_id: int,
    payload: RunStrategyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Run a strategy against current/live market data and generate signals.
    Returns the latest signal (BUY/SELL/HOLD) with indicator context.
    """
    result = await db.execute(
        select(Strategy).where(Strategy.id == strategy_id)
    )
    strategy: Optional[Strategy] = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    if strategy.user_id != current_user.id and not strategy.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    from app.services.market_data import market_data_service
    from app.indicators.technical import (
        calculate_rsi, calculate_macd, calculate_ema,
        calculate_supertrend, calculate_atr,
    )
    import pandas as pd

    df = await market_data_service.fetch_candles_as_dataframe(
        payload.symbol, payload.timeframe, payload.exchange, limit=200
    )

    if df is None or df.empty:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch market data for strategy run",
        )

    # Compute indicators
    close = df["close"]
    rsi = calculate_rsi(close, 14)
    macd_data = calculate_macd(close)
    ema9 = calculate_ema(close, 9)
    ema21 = calculate_ema(close, 21)
    st = calculate_supertrend(df)

    current_rsi = float(rsi.iloc[-1])
    current_macd_hist = float(macd_data["histogram"].iloc[-1])
    prev_macd_hist = float(macd_data["histogram"].iloc[-2])
    current_ema9 = float(ema9.iloc[-1])
    current_ema21 = float(ema21.iloc[-1])
    supertrend_dir = int(st["direction"].iloc[-1])
    current_price = float(close.iloc[-1])

    # Default signal logic based on strategy type
    signal = "HOLD"
    reasons = []
    strength = 0

    if strategy.strategy_type == "TREND_FOLLOWING":
        if supertrend_dir == 1:
            strength += 1
            reasons.append("Supertrend Bullish")
        if current_ema9 > current_ema21:
            strength += 1
            reasons.append("EMA 9 > EMA 21")
        if current_macd_hist > 0 and prev_macd_hist <= 0:
            strength += 2
            reasons.append("MACD Bullish crossover")
        signal = "BUY" if strength >= 2 else "HOLD"

    elif strategy.strategy_type == "MEAN_REVERSION":
        if current_rsi <= 30:
            strength += 2
            reasons.append(f"RSI Oversold ({current_rsi:.1f})")
        if current_rsi >= 70:
            strength -= 2
            reasons.append(f"RSI Overbought ({current_rsi:.1f})")
        signal = "BUY" if strength >= 2 else ("SELL" if strength <= -2 else "HOLD")

    elif strategy.strategy_type == "BREAKOUT":
        recent_high = float(df["high"].iloc[-20:-1].max())
        if current_price > recent_high * 0.995:
            signal = "BUY"
            reasons.append(f"Price near 20-bar high ({recent_high:.2f})")
        recent_low = float(df["low"].iloc[-20:-1].min())
        if current_price < recent_low * 1.005:
            signal = "SELL"
            reasons.append(f"Price near 20-bar low ({recent_low:.2f})")

    return {
        "strategy_id": strategy_id,
        "symbol": payload.symbol,
        "exchange": payload.exchange,
        "timeframe": payload.timeframe,
        "signal": signal,
        "signal_strength": strength,
        "reasons": reasons,
        "indicators": {
            "rsi": round(current_rsi, 2),
            "macd_histogram": round(current_macd_hist, 4),
            "ema_9": round(current_ema9, 2),
            "ema_21": round(current_ema21, 2),
            "supertrend_direction": supertrend_dir,
            "current_price": round(current_price, 2),
        },
        "timestamp": datetime.utcnow().isoformat(),
    }
