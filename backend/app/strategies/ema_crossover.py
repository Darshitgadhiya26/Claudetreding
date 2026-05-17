"""
EMA Crossover Strategy
----------------------
- Buy  : fast EMA crosses above slow EMA (golden cross)
- Sell : fast EMA crosses below slow EMA (death cross)
- Parameters:
    fast_period (int, default 9)
    slow_period (int, default 21)
"""

import pandas as pd

from app.strategies.base import BaseStrategy


class EMACrossoverStrategy(BaseStrategy):
    """Classic dual-EMA crossover strategy."""

    def __init__(self, params: dict = None):
        params = params or {}
        defaults = {
            "fast_period": 9,
            "slow_period": 21,
        }
        defaults.update(params)
        super().__init__(defaults)
        self.name = "EMA Crossover"
        self.validate_params(["fast_period", "slow_period"])

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add 'signal', 'ema_fast', 'ema_slow' columns.

        Expects columns: open, high, low, close, volume
        """
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        fast = int(self.params["fast_period"])
        slow = int(self.params["slow_period"])

        if fast >= slow:
            raise ValueError(
                f"fast_period ({fast}) must be less than slow_period ({slow})"
            )

        # ── EMA calculations ───────────────────────────────────────────────
        df["ema_fast"] = df["close"].ewm(span=fast, adjust=False).mean()
        df["ema_slow"] = df["close"].ewm(span=slow, adjust=False).mean()

        # ── Crossover detection ────────────────────────────────────────────
        df["ema_diff"] = df["ema_fast"] - df["ema_slow"]
        df["prev_ema_diff"] = df["ema_diff"].shift(1)

        # Golden cross: fast crosses above slow
        bullish_cross = (df["prev_ema_diff"] <= 0) & (df["ema_diff"] > 0)
        # Death cross: fast crosses below slow
        bearish_cross = (df["prev_ema_diff"] >= 0) & (df["ema_diff"] < 0)

        # ── Signals ────────────────────────────────────────────────────────
        df["signal"] = 0
        df.loc[bullish_cross, "signal"] = 1
        df.loc[bearish_cross, "signal"] = -1

        # Drop helper columns
        df.drop(columns=["ema_diff", "prev_ema_diff"], inplace=True)

        return df
