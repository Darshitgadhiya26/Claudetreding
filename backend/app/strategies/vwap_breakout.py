"""
VWAP Breakout Strategy
----------------------
- Buy  : price breaks above VWAP accompanied by a volume surge
- Sell : price drops back below VWAP
- Parameters:
    volume_multiplier  (float, default 1.5) – volume must be N× its rolling average
    sl_percent         (float, default 0.5) – stop-loss % below entry price
"""

import pandas as pd
import numpy as np

from app.strategies.base import BaseStrategy


class VWAPBreakoutStrategy(BaseStrategy):
    """Intraday VWAP breakout with volume confirmation."""

    def __init__(self, params: dict = None):
        params = params or {}
        defaults = {
            "volume_multiplier": 1.5,
            "sl_percent": 0.5,
            "volume_avg_period": 20,
        }
        defaults.update(params)
        super().__init__(defaults)
        self.name = "VWAP Breakout"

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add 'signal' column: 1=BUY, -1=SELL, 0=HOLD.

        Expects columns: open, high, low, close, volume
        """
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        # ── VWAP (cumulative for the session) ──────────────────────────────
        df["typical_price"] = (df["high"] + df["low"] + df["close"]) / 3
        df["tp_vol"] = df["typical_price"] * df["volume"]
        df["cum_tp_vol"] = df["tp_vol"].cumsum()
        df["cum_vol"] = df["volume"].cumsum()
        df["vwap"] = df["cum_tp_vol"] / df["cum_vol"]

        # ── Volume average ─────────────────────────────────────────────────
        vol_period = int(self.params["volume_avg_period"])
        mult = float(self.params["volume_multiplier"])
        df["vol_avg"] = df["volume"].rolling(window=vol_period, min_periods=1).mean()
        df["vol_surge"] = df["volume"] > (df["vol_avg"] * mult)

        # ── Price vs VWAP ──────────────────────────────────────────────────
        df["above_vwap"] = df["close"] > df["vwap"]
        df["prev_above_vwap"] = df["above_vwap"].shift(1).fillna(False)

        # Crossover: was below → now above VWAP with volume surge
        df["breakout_up"] = (~df["prev_above_vwap"]) & df["above_vwap"] & df["vol_surge"]
        # Cross-under: was above → now below VWAP
        df["breakout_down"] = df["prev_above_vwap"] & (~df["above_vwap"])

        # ── Signal generation ──────────────────────────────────────────────
        df["signal"] = 0
        df.loc[df["breakout_up"], "signal"] = 1
        df.loc[df["breakout_down"], "signal"] = -1

        # Carry the 'vwap' column through for chart overlay use
        keep_cols = list(data.columns) + ["vwap", "vol_avg", "signal"]
        extra = [c for c in keep_cols if c.lower() in df.columns]
        result = df[[c.lower() for c in extra]].copy()
        result.columns = [c.lower() for c in extra]
        return result

    def get_stop_loss(self, entry_price: float) -> float:
        """Calculate stop-loss price below entry."""
        sl_pct = float(self.params["sl_percent"]) / 100
        return round(entry_price * (1 - sl_pct), 2)
