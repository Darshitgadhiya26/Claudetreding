"""
RSI Reversal Strategy
---------------------
- Buy  : RSI crosses above the oversold level (default 30) from below
- Sell : RSI crosses below the overbought level (default 70) from above
- Parameters:
    rsi_period (int,   default 14)
    oversold   (float, default 30)
    overbought (float, default 70)
"""

import pandas as pd
import numpy as np

from app.strategies.base import BaseStrategy


class RSIReversalStrategy(BaseStrategy):
    """Mean-reversion strategy based on RSI extremes."""

    def __init__(self, params: dict = None):
        params = params or {}
        defaults = {
            "rsi_period": 14,
            "oversold": 30,
            "overbought": 70,
        }
        defaults.update(params)
        super().__init__(defaults)
        self.name = "RSI Reversal"
        self.validate_params(["rsi_period", "oversold", "overbought"])

    def _calculate_rsi(self, close: pd.Series, period: int) -> pd.Series:
        """Wilder's smoothed RSI."""
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)

        # Wilder's smoothing (exponential with alpha = 1/period)
        avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add 'signal' and 'rsi' columns.

        Expects columns: open, high, low, close, volume
        """
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        period = int(self.params["rsi_period"])
        oversold = float(self.params["oversold"])
        overbought = float(self.params["overbought"])

        df["rsi"] = self._calculate_rsi(df["close"], period)

        # Previous RSI value for crossover detection
        df["prev_rsi"] = df["rsi"].shift(1)

        # BUY : RSI crosses above oversold threshold from below
        bullish = (df["prev_rsi"] <= oversold) & (df["rsi"] > oversold)

        # SELL: RSI crosses below overbought threshold from above
        bearish = (df["prev_rsi"] >= overbought) & (df["rsi"] < overbought)

        df["signal"] = 0
        df.loc[bullish, "signal"] = 1
        df.loc[bearish, "signal"] = -1

        df.drop(columns=["prev_rsi"], inplace=True)

        return df
