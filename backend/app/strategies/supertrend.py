"""
Supertrend Strategy
-------------------
- Buy  : price crosses above the supertrend line (trend flips bullish)
- Sell : price crosses below the supertrend line (trend flips bearish)
- Parameters:
    period     (int,   default 7)
    multiplier (float, default 3.0)
"""

import pandas as pd
import numpy as np

from app.strategies.base import BaseStrategy


class SupertrendStrategy(BaseStrategy):
    """Trend-following strategy using the Supertrend indicator."""

    def __init__(self, params: dict = None):
        params = params or {}
        defaults = {
            "period": 7,
            "multiplier": 3.0,
        }
        defaults.update(params)
        super().__init__(defaults)
        self.name = "Supertrend"
        self.validate_params(["period", "multiplier"])

    def _calculate_atr(self, df: pd.DataFrame, period: int) -> pd.Series:
        """Average True Range using Wilder's smoothing."""
        high = df["high"]
        low = df["low"]
        prev_close = df["close"].shift(1)

        tr = pd.concat(
            [
                high - low,
                (high - prev_close).abs(),
                (low - prev_close).abs(),
            ],
            axis=1,
        ).max(axis=1)

        return tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    def _calculate_supertrend(
        self, df: pd.DataFrame, period: int, multiplier: float
    ) -> tuple[pd.Series, pd.Series]:
        """
        Compute supertrend line and direction.

        Returns
        -------
        supertrend : pd.Series  – the indicator line value
        direction  : pd.Series  – 1 = bullish (price above), -1 = bearish
        """
        atr = self._calculate_atr(df, period)
        hl2 = (df["high"] + df["low"]) / 2

        upper_band = hl2 + multiplier * atr
        lower_band = hl2 - multiplier * atr

        supertrend = pd.Series(np.nan, index=df.index)
        direction = pd.Series(1, index=df.index)  # 1 = up, -1 = down

        for i in range(1, len(df)):
            prev_upper = upper_band.iloc[i - 1]
            prev_lower = lower_band.iloc[i - 1]
            close = df["close"].iloc[i]
            prev_close = df["close"].iloc[i - 1]

            # Adjust bands: never widen in a trend
            if lower_band.iloc[i] < prev_lower or prev_close < prev_lower:
                lower_band.iloc[i] = lower_band.iloc[i]
            else:
                lower_band.iloc[i] = prev_lower

            if upper_band.iloc[i] > prev_upper or prev_close > prev_upper:
                upper_band.iloc[i] = upper_band.iloc[i]
            else:
                upper_band.iloc[i] = prev_upper

            # Determine direction
            prev_st = supertrend.iloc[i - 1]
            if pd.isna(prev_st):
                direction.iloc[i] = 1
                supertrend.iloc[i] = lower_band.iloc[i]
                continue

            prev_dir = direction.iloc[i - 1]
            if prev_dir == -1 and close > prev_upper:
                direction.iloc[i] = 1
            elif prev_dir == 1 and close < prev_lower:
                direction.iloc[i] = -1
            else:
                direction.iloc[i] = prev_dir

            supertrend.iloc[i] = (
                lower_band.iloc[i] if direction.iloc[i] == 1 else upper_band.iloc[i]
            )

        return supertrend, direction

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add 'signal', 'supertrend', and 'supertrend_dir' columns.

        Expects columns: open, high, low, close, volume
        """
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        period = int(self.params["period"])
        multiplier = float(self.params["multiplier"])

        df["supertrend"], df["supertrend_dir"] = self._calculate_supertrend(
            df, period, multiplier
        )

        prev_dir = df["supertrend_dir"].shift(1)

        # Flip to bullish
        bullish = (prev_dir == -1) & (df["supertrend_dir"] == 1)
        # Flip to bearish
        bearish = (prev_dir == 1) & (df["supertrend_dir"] == -1)

        df["signal"] = 0
        df.loc[bullish, "signal"] = 1
        df.loc[bearish, "signal"] = -1

        return df
