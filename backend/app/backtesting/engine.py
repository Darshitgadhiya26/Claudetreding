"""
Backtesting Engine
==================
Candle-by-candle simulation of strategy signals with:
  - Stop-loss and take-profit management
  - Optional trailing stop-loss
  - Comprehensive performance metrics
"""

from __future__ import annotations

import math
import logging
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
import pandas as pd

from app.strategies.base import BaseStrategy

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Data Classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Trade:
    """Represents a single closed (or open) trade."""
    entry_time: object
    entry_price: float
    direction: int          # +1 = long, -1 = short
    quantity: int = 1
    exit_time: object = None
    exit_price: Optional[float] = None
    exit_reason: str = ""   # "SL", "TARGET", "SIGNAL", "EOD"
    pnl: float = 0.0
    pnl_pct: float = 0.0
    brokerage: float = 0.0

    @property
    def is_open(self) -> bool:
        return self.exit_price is None

    @property
    def net_pnl(self) -> float:
        return self.pnl - self.brokerage


@dataclass
class BacktestResult:
    """Container for all backtest output metrics."""
    # Core metrics
    total_pnl: float = 0.0
    total_pnl_pct: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0

    # Risk metrics
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    cagr: float = 0.0

    # Trade statistics
    avg_win: float = 0.0
    avg_loss: float = 0.0
    profit_factor: float = 0.0
    max_consecutive_wins: int = 0
    max_consecutive_losses: int = 0
    avg_trade_duration_bars: float = 0.0
    expectancy: float = 0.0

    # Capital
    initial_capital: float = 100_000.0
    final_capital: float = 100_000.0

    # Series (populated separately)
    equity_curve: list = field(default_factory=list)
    trades: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_pnl": round(self.total_pnl, 2),
            "total_pnl_pct": round(self.total_pnl_pct, 2),
            "win_rate": round(self.win_rate, 2),
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "max_drawdown": round(self.max_drawdown, 2),
            "max_drawdown_pct": round(self.max_drawdown_pct, 2),
            "sharpe_ratio": round(self.sharpe_ratio, 2),
            "sortino_ratio": round(self.sortino_ratio, 2),
            "calmar_ratio": round(self.calmar_ratio, 2),
            "cagr": round(self.cagr, 2),
            "avg_win": round(self.avg_win, 2),
            "avg_loss": round(self.avg_loss, 2),
            "profit_factor": round(self.profit_factor, 2),
            "max_consecutive_wins": self.max_consecutive_wins,
            "max_consecutive_losses": self.max_consecutive_losses,
            "avg_trade_duration_bars": round(self.avg_trade_duration_bars, 1),
            "expectancy": round(self.expectancy, 2),
            "initial_capital": self.initial_capital,
            "final_capital": round(self.final_capital, 2),
            "equity_curve": self.equity_curve,
            "trades": self.trades,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Engine
# ─────────────────────────────────────────────────────────────────────────────

class BacktestEngine:
    """
    Candle-by-candle backtesting engine.

    Parameters
    ----------
    initial_capital : float
        Starting capital in INR (default 1,00,000).
    brokerage_per_trade : float
        Flat brokerage per side in INR (default 20 – Zerodha style).
    lot_size : int
        Number of shares/units per trade (default 1).
    """

    def __init__(
        self,
        initial_capital: float = 100_000.0,
        brokerage_per_trade: float = 20.0,
        lot_size: int = 1,
    ):
        self.initial_capital = initial_capital
        self.brokerage_per_trade = brokerage_per_trade
        self.lot_size = lot_size

    # ── Public API ─────────────────────────────────────────────────────────

    def run(
        self,
        strategy: BaseStrategy,
        data: pd.DataFrame,
        sl_percent: float = 1.0,
        target_percent: float = 2.0,
        trailing_sl: bool = False,
        position_size_pct: float = 10.0,
    ) -> BacktestResult:
        """
        Run the full backtest.

        Parameters
        ----------
        strategy         : BaseStrategy subclass instance
        data             : OHLCV DataFrame (open, high, low, close, volume)
        sl_percent       : Stop-loss as % of entry price (0 to disable)
        target_percent   : Take-profit as % of entry price (0 to disable)
        trailing_sl      : Activate trailing stop-loss
        position_size_pct: Capital allocated per trade as % (default 10%)

        Returns
        -------
        BacktestResult
        """
        if data.empty:
            logger.warning("Empty data passed to BacktestEngine.run()")
            return BacktestResult(initial_capital=self.initial_capital)

        # Normalise columns
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        # Generate signals
        try:
            signal_df = strategy.generate_signals(df)
        except Exception as exc:
            logger.error(f"Signal generation failed: {exc}", exc_info=True)
            return BacktestResult(initial_capital=self.initial_capital)

        if "signal" not in signal_df.columns:
            logger.error("Strategy did not add 'signal' column.")
            return BacktestResult(initial_capital=self.initial_capital)

        closed_trades, equity_curve = self._simulate_trades(
            signal_df,
            sl_percent=sl_percent,
            target_percent=target_percent,
            trailing_sl=trailing_sl,
            position_size_pct=position_size_pct,
        )

        result = self.calculate_metrics(closed_trades, equity_curve)
        result.equity_curve = [round(v, 2) for v in equity_curve]
        result.trades = [self._trade_to_dict(t) for t in closed_trades]
        return result

    # ── Simulation Core ────────────────────────────────────────────────────

    def _simulate_trades(
        self,
        df: pd.DataFrame,
        sl_percent: float,
        target_percent: float,
        trailing_sl: bool,
        position_size_pct: float,
    ) -> tuple[list[Trade], list[float]]:
        """Candle-by-candle simulation loop."""

        capital = self.initial_capital
        equity_curve: list[float] = [capital]
        closed_trades: list[Trade] = []

        open_trade: Optional[Trade] = None
        trailing_stop: Optional[float] = None

        for i, (idx, row) in enumerate(df.iterrows()):
            signal = int(row.get("signal", 0))
            close_price = float(row["close"])
            high_price = float(row["high"])
            low_price = float(row["low"])

            # ── Manage open position ───────────────────────────────────────
            if open_trade is not None:
                trade = open_trade
                direction = trade.direction
                entry = trade.entry_price

                # Compute active SL and target
                active_sl: Optional[float] = None
                active_target: Optional[float] = None

                if sl_percent > 0:
                    if trailing_sl and trailing_stop is not None:
                        active_sl = trailing_stop
                    else:
                        active_sl = entry * (1 - sl_percent / 100) if direction == 1 else entry * (1 + sl_percent / 100)

                if target_percent > 0:
                    active_target = entry * (1 + target_percent / 100) if direction == 1 else entry * (1 - target_percent / 100)

                exit_price: Optional[float] = None
                exit_reason = ""

                if direction == 1:  # Long
                    if active_sl is not None and low_price <= active_sl:
                        exit_price = active_sl
                        exit_reason = "SL"
                    elif active_target is not None and high_price >= active_target:
                        exit_price = active_target
                        exit_reason = "TARGET"
                    elif signal == -1:
                        exit_price = close_price
                        exit_reason = "SIGNAL"
                else:  # Short
                    if active_sl is not None and high_price >= active_sl:
                        exit_price = active_sl
                        exit_reason = "SL"
                    elif active_target is not None and low_price <= active_target:
                        exit_price = active_target
                        exit_reason = "TARGET"
                    elif signal == 1:
                        exit_price = close_price
                        exit_reason = "SIGNAL"

                if exit_price is not None:
                    # Close trade
                    pnl = direction * (exit_price - entry) * trade.quantity
                    brokerage = self.brokerage_per_trade * 2  # Entry + exit
                    trade.exit_time = idx
                    trade.exit_price = exit_price
                    trade.exit_reason = exit_reason
                    trade.pnl = pnl
                    trade.brokerage = brokerage
                    trade.pnl_pct = (pnl / (entry * trade.quantity)) * 100

                    capital += pnl - brokerage
                    closed_trades.append(trade)
                    open_trade = None
                    trailing_stop = None
                else:
                    # Update trailing SL
                    if trailing_sl and sl_percent > 0:
                        if direction == 1:
                            new_tsl = close_price * (1 - sl_percent / 100)
                            if trailing_stop is None or new_tsl > trailing_stop:
                                trailing_stop = new_tsl
                        else:
                            new_tsl = close_price * (1 + sl_percent / 100)
                            if trailing_stop is None or new_tsl < trailing_stop:
                                trailing_stop = new_tsl

            # ── Open new position ──────────────────────────────────────────
            if open_trade is None and signal in (1, -1):
                position_capital = capital * (position_size_pct / 100)
                qty = max(1, int(position_capital / close_price) * self.lot_size)

                open_trade = Trade(
                    entry_time=idx,
                    entry_price=close_price,
                    direction=signal,
                    quantity=qty,
                )

                if trailing_sl and sl_percent > 0:
                    if signal == 1:
                        trailing_stop = close_price * (1 - sl_percent / 100)
                    else:
                        trailing_stop = close_price * (1 + sl_percent / 100)

            equity_curve.append(round(capital, 2))

        # ── Close any open trade at end of data ────────────────────────────
        if open_trade is not None:
            last_close = float(df["close"].iloc[-1])
            last_idx = df.index[-1]
            pnl = open_trade.direction * (last_close - open_trade.entry_price) * open_trade.quantity
            brokerage = self.brokerage_per_trade * 2
            open_trade.exit_time = last_idx
            open_trade.exit_price = last_close
            open_trade.exit_reason = "EOD"
            open_trade.pnl = pnl
            open_trade.brokerage = brokerage
            open_trade.pnl_pct = (pnl / (open_trade.entry_price * open_trade.quantity)) * 100
            capital += pnl - brokerage
            closed_trades.append(open_trade)
            equity_curve.append(round(capital, 2))

        return closed_trades, equity_curve

    # ── Metrics ────────────────────────────────────────────────────────────

    def calculate_metrics(
        self, trades: list[Trade], equity_curve: list[float]
    ) -> BacktestResult:
        """
        Compute comprehensive performance metrics.

        Parameters
        ----------
        trades       : list of closed Trade objects
        equity_curve : list of capital values after each candle

        Returns
        -------
        BacktestResult (equity_curve and trades lists NOT populated here)
        """
        result = BacktestResult(initial_capital=self.initial_capital)

        if not trades:
            result.final_capital = self.initial_capital
            return result

        final_cap = equity_curve[-1] if equity_curve else self.initial_capital
        result.final_capital = final_cap

        pnls = [t.net_pnl for t in trades]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p <= 0]

        result.total_trades = len(trades)
        result.winning_trades = len(wins)
        result.losing_trades = len(losses)
        result.total_pnl = sum(pnls)
        result.total_pnl_pct = (result.total_pnl / self.initial_capital) * 100
        result.win_rate = (len(wins) / len(trades)) * 100 if trades else 0.0
        result.avg_win = sum(wins) / len(wins) if wins else 0.0
        result.avg_loss = sum(losses) / len(losses) if losses else 0.0

        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        result.profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else float("inf")

        # Expectancy = (win_rate × avg_win) + (loss_rate × avg_loss)
        win_rate_dec = result.winning_trades / result.total_trades
        result.expectancy = (win_rate_dec * result.avg_win) + (
            (1 - win_rate_dec) * result.avg_loss
        )

        # Max consecutive wins / losses
        result.max_consecutive_wins, result.max_consecutive_losses = (
            self._consecutive_streaks(pnls)
        )

        # Average trade duration
        durations = []
        for t in trades:
            if t.entry_time is not None and t.exit_time is not None:
                try:
                    dur = t.exit_time - t.entry_time
                    if hasattr(dur, "total_seconds"):
                        durations.append(dur.total_seconds())
                    else:
                        durations.append(float(dur))
                except Exception:
                    pass
        result.avg_trade_duration_bars = sum(durations) / len(durations) if durations else 0.0

        # Drawdown
        result.max_drawdown, result.max_drawdown_pct = self.calculate_max_drawdown(equity_curve)

        # CAGR – estimate years from number of bars
        n_bars = len(equity_curve)
        # Assume 252 trading days × 75 5-min bars ≈ 18900 bars/year; use simpler bar→year heuristic
        years = max(n_bars / 252, 0.01)  # Works best for daily bars
        result.cagr = self.calculate_cagr(self.initial_capital, final_cap, years)

        # Sharpe (daily returns from equity curve)
        eq_series = pd.Series(equity_curve)
        daily_returns = eq_series.pct_change().dropna()
        result.sharpe_ratio = self.calculate_sharpe(daily_returns)
        result.sortino_ratio = self._calculate_sortino(daily_returns)

        # Calmar
        if result.max_drawdown_pct > 0:
            result.calmar_ratio = result.cagr / result.max_drawdown_pct
        else:
            result.calmar_ratio = float("inf")

        return result

    # ── Sub-calculations ───────────────────────────────────────────────────

    def calculate_sharpe(
        self, returns: pd.Series, risk_free_rate: float = 0.065
    ) -> float:
        """
        Annualised Sharpe Ratio.

        Uses Indian 10-year government bond yield as risk-free rate (≈6.5 %).
        Assumes 252 trading days per year.
        """
        if returns.empty or returns.std() == 0:
            return 0.0
        rf_daily = risk_free_rate / 252
        excess = returns - rf_daily
        sharpe = excess.mean() / excess.std(ddof=1) * math.sqrt(252)
        return round(sharpe, 4)

    def _calculate_sortino(
        self, returns: pd.Series, risk_free_rate: float = 0.065
    ) -> float:
        """Annualised Sortino Ratio (downside deviation only)."""
        if returns.empty:
            return 0.0
        rf_daily = risk_free_rate / 252
        excess = returns - rf_daily
        downside = excess[excess < 0]
        if len(downside) == 0 or downside.std(ddof=1) == 0:
            return float("inf")
        sortino = excess.mean() / downside.std(ddof=1) * math.sqrt(252)
        return round(sortino, 4)

    def calculate_max_drawdown(
        self, equity_curve: list[float]
    ) -> tuple[float, float]:
        """
        Rolling maximum drawdown.

        Returns
        -------
        (absolute_drawdown, drawdown_pct)
        """
        if not equity_curve:
            return 0.0, 0.0

        eq = np.array(equity_curve, dtype=float)
        running_max = np.maximum.accumulate(eq)
        drawdown = eq - running_max          # Always <= 0
        max_dd_abs = float(abs(drawdown.min()))
        peak = float(running_max[np.argmin(drawdown)])
        max_dd_pct = (max_dd_abs / peak * 100) if peak > 0 else 0.0
        return round(max_dd_abs, 2), round(max_dd_pct, 2)

    def calculate_cagr(
        self, initial: float, final: float, years: float
    ) -> float:
        """
        Compound Annual Growth Rate.

        CAGR = (final / initial) ^ (1/years) - 1
        """
        if initial <= 0 or years <= 0 or final <= 0:
            return 0.0
        cagr = (final / initial) ** (1 / years) - 1
        return round(cagr * 100, 4)  # Return as percentage

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _consecutive_streaks(pnls: list[float]) -> tuple[int, int]:
        """Return (max_consecutive_wins, max_consecutive_losses)."""
        max_wins = max_losses = cur_wins = cur_losses = 0
        for p in pnls:
            if p > 0:
                cur_wins += 1
                cur_losses = 0
            else:
                cur_losses += 1
                cur_wins = 0
            max_wins = max(max_wins, cur_wins)
            max_losses = max(max_losses, cur_losses)
        return max_wins, max_losses

    @staticmethod
    def _trade_to_dict(t: Trade) -> dict:
        return {
            "entry_time": str(t.entry_time),
            "entry_price": round(t.entry_price, 2),
            "exit_time": str(t.exit_time),
            "exit_price": round(t.exit_price, 2) if t.exit_price else None,
            "direction": "LONG" if t.direction == 1 else "SHORT",
            "quantity": t.quantity,
            "pnl": round(t.pnl, 2),
            "net_pnl": round(t.net_pnl, 2),
            "pnl_pct": round(t.pnl_pct, 2),
            "exit_reason": t.exit_reason,
        }
