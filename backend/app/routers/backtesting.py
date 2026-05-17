from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import logging

from app.database import get_db
from app.models.backtest import BacktestResult
from app.models.strategy import Strategy
from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backtesting", tags=["Backtesting"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class BacktestRunRequest(BaseModel):
    strategy_id: int
    symbol: str
    exchange: str = "NSE"
    timeframe: str = "15m"
    start_date: datetime
    end_date: datetime
    initial_capital: float = Field(default=100000.0, gt=0)
    commission_per_trade: float = 20.0
    sl_percent: float = Field(default=1.0, gt=0, le=20)
    target_percent: float = Field(default=2.0, gt=0, le=50)
    trailing_sl: bool = False
    position_size_pct: float = Field(default=10.0, gt=0, le=100)


class BacktestResultResponse(BaseModel):
    id: int
    strategy_id: int
    user_id: int
    symbol: str
    exchange: str
    timeframe: str
    start_date: datetime
    end_date: datetime
    initial_capital: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_pnl: float
    total_pnl_percent: float
    gross_profit: float
    gross_loss: float
    win_rate: float
    profit_factor: Optional[float]
    max_drawdown: float
    max_drawdown_percent: float
    sharpe_ratio: Optional[float]
    sortino_ratio: Optional[float]
    calmar_ratio: Optional[float]
    cagr: Optional[float]
    expectancy: Optional[float]
    final_capital: float
    avg_trade_duration_minutes: Optional[float]
    equity_curve: Optional[list]
    trade_log: Optional[list]
    monthly_returns: Optional[dict]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run", response_model=BacktestResultResponse, status_code=status.HTTP_201_CREATED)
async def run_backtest(
    payload: BacktestRunRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Run a strategy backtest.
    Executes synchronously for small date ranges; use BackgroundTasks for large ones.
    """
    # Verify strategy exists and user has access
    strat_result = await db.execute(
        select(Strategy).where(Strategy.id == payload.strategy_id)
    )
    strategy: Optional[Strategy] = strat_result.scalar_one_or_none()

    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    if strategy.user_id != current_user.id and not strategy.is_public:
        raise HTTPException(status_code=403, detail="Access denied to strategy")

    # Validate dates
    if payload.start_date >= payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date must be before end_date",
        )

    # Create a pending result record
    backtest_record = BacktestResult(
        strategy_id=payload.strategy_id,
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        exchange=payload.exchange.upper(),
        timeframe=payload.timeframe,
        start_date=payload.start_date,
        end_date=payload.end_date,
        initial_capital=payload.initial_capital,
        status="RUNNING",
    )
    db.add(backtest_record)
    await db.commit()
    await db.refresh(backtest_record)

    # Run the backtest
    try:
        from app.backtesting.engine import BacktestEngine
        from app.services.market_data import market_data_service

        engine = BacktestEngine(
            initial_capital=payload.initial_capital,
            brokerage_per_trade=payload.commission_per_trade,
        )

        # Fetch data
        df = await market_data_service.fetch_candles_as_dataframe(
            payload.symbol,
            payload.timeframe,
            payload.exchange,
            from_date=payload.start_date,
            to_date=payload.end_date,
            limit=5000,
        )

        if df is None or df.empty:
            backtest_record.status = "FAILED"
            backtest_record.error_message = "No market data available for the selected period"
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No market data available for the selected period",
            )

        # Build a simple strategy wrapper from strategy params
        class ParamStrategy:
            """Adapter that wraps strategy parameters for the engine."""
            def __init__(self, params: dict, strat_type: str):
                self.params = params
                self.strategy_type = strat_type

            def generate_signals(self, df):
                from app.indicators.technical import (
                    calculate_ema, calculate_rsi, calculate_macd, calculate_supertrend
                )
                import pandas as pd
                import numpy as np

                close = df["close"]
                df["ema9"] = calculate_ema(close, 9)
                df["ema21"] = calculate_ema(close, 21)
                df["rsi"] = calculate_rsi(close, 14)
                macd = calculate_macd(close)
                df["macd_hist"] = macd["histogram"]
                st = calculate_supertrend(df)
                df["st_dir"] = st["direction"]

                df["signal"] = 0

                if self.strategy_type in ("TREND_FOLLOWING", "CUSTOM"):
                    # EMA 9/21 crossover
                    bull_cross = (df["ema9"] > df["ema21"]) & (df["ema9"].shift(1) <= df["ema21"].shift(1))
                    bear_cross = (df["ema9"] < df["ema21"]) & (df["ema9"].shift(1) >= df["ema21"].shift(1))
                    df.loc[bull_cross, "signal"] = 1
                    df.loc[bear_cross, "signal"] = -1

                elif self.strategy_type == "MEAN_REVERSION":
                    df.loc[df["rsi"] < 30, "signal"] = 1
                    df.loc[df["rsi"] > 70, "signal"] = -1

                elif self.strategy_type == "MOMENTUM":
                    macd_bull = (df["macd_hist"] > 0) & (df["macd_hist"].shift(1) <= 0)
                    macd_bear = (df["macd_hist"] < 0) & (df["macd_hist"].shift(1) >= 0)
                    df.loc[macd_bull, "signal"] = 1
                    df.loc[macd_bear, "signal"] = -1

                elif self.strategy_type == "BREAKOUT":
                    df["rolling_high"] = df["high"].shift(1).rolling(20).max()
                    df["rolling_low"] = df["low"].shift(1).rolling(20).min()
                    df.loc[df["close"] > df["rolling_high"], "signal"] = 1
                    df.loc[df["close"] < df["rolling_low"], "signal"] = -1

                return df

        strat_instance = ParamStrategy(strategy.parameters, strategy.strategy_type)

        bt_result = engine.run(
            strat_instance,
            df,
            sl_percent=payload.sl_percent,
            target_percent=payload.target_percent,
            trailing_sl=payload.trailing_sl,
            position_size_pct=payload.position_size_pct,
        )

        result_dict = bt_result.to_dict()

        # Update the backtest record
        backtest_record.total_trades = result_dict["total_trades"]
        backtest_record.winning_trades = result_dict["winning_trades"]
        backtest_record.losing_trades = result_dict["losing_trades"]
        backtest_record.total_pnl = result_dict["total_pnl"]
        backtest_record.total_pnl_percent = result_dict["total_pnl_pct"]
        backtest_record.gross_profit = result_dict.get("avg_win", 0) * result_dict.get("winning_trades", 0)
        backtest_record.gross_loss = abs(result_dict.get("avg_loss", 0)) * result_dict.get("losing_trades", 0)
        backtest_record.win_rate = result_dict["win_rate"]
        backtest_record.profit_factor = result_dict.get("profit_factor", 0)
        backtest_record.max_drawdown = result_dict["max_drawdown"]
        backtest_record.max_drawdown_percent = result_dict["max_drawdown_pct"]
        backtest_record.sharpe_ratio = result_dict.get("sharpe_ratio")
        backtest_record.sortino_ratio = result_dict.get("sortino_ratio")
        backtest_record.calmar_ratio = result_dict.get("calmar_ratio")
        backtest_record.cagr = result_dict.get("cagr")
        backtest_record.expectancy = result_dict.get("expectancy")
        backtest_record.final_capital = result_dict["final_capital"]
        backtest_record.avg_trade_duration_minutes = result_dict.get("avg_trade_duration_bars")
        backtest_record.equity_curve = result_dict.get("equity_curve", [])
        backtest_record.trade_log = result_dict.get("trades", [])
        backtest_record.status = "COMPLETED"

        # Update strategy summary
        strategy.last_backtest_sharpe = result_dict.get("sharpe_ratio")
        strategy.last_backtest_win_rate = result_dict.get("win_rate")

        await db.commit()
        await db.refresh(backtest_record)
        return backtest_record

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Backtest failed: {e}", exc_info=True)
        backtest_record.status = "FAILED"
        backtest_record.error_message = str(e)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backtest failed: {str(e)}",
        )


@router.get("/results", response_model=List[BacktestResultResponse])
async def list_backtest_results(
    strategy_id: Optional[int] = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List backtest results for the current user."""
    query = select(BacktestResult).where(BacktestResult.user_id == current_user.id)
    if strategy_id:
        query = query.where(BacktestResult.strategy_id == strategy_id)
    query = query.order_by(BacktestResult.created_at.desc()).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/results/{result_id}", response_model=BacktestResultResponse)
async def get_backtest_result(
    result_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific backtest result with full equity curve and trade log."""
    result = await db.execute(
        select(BacktestResult).where(
            and_(BacktestResult.id == result_id, BacktestResult.user_id == current_user.id)
        )
    )
    bt_result = result.scalar_one_or_none()
    if not bt_result:
        raise HTTPException(status_code=404, detail="Backtest result not found")
    return bt_result


@router.delete("/results/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backtest_result(
    result_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a backtest result."""
    result = await db.execute(
        select(BacktestResult).where(
            and_(BacktestResult.id == result_id, BacktestResult.user_id == current_user.id)
        )
    )
    bt_result = result.scalar_one_or_none()
    if not bt_result:
        raise HTTPException(status_code=404, detail="Backtest result not found")
    await db.delete(bt_result)
    await db.commit()
