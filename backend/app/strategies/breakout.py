"""
Breakout Strategy
-----------------
- Buy  : price breaks above the N-day rolling high (with optional confirmation candles)
- Sell : price breaks below the N-day rolling low
- Parameters:
    lookback             (int, default 20) – look-back window for high/low
    confirmation_candles (int, default 1)  – number of candles above/below level to confirm
"""

import pandas as pd

from app.strategies.base import BaseStrategy


class BreakoutStrategy(BaseStrategy):
    """N-day channel breakout strategy."""

    def __init__(self, params: dict = None):
        params = params or {}
        defaults = {
            "lookback": 20,
            "confirmation_candles": 1,
        }
        defaults.update(params)
        super().__init__(defaults)
        self.name = "Breakout"
        self.validate_params(["lookback", "confirmation_candles"])

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add 'signal', 'rolling_high', and 'rolling_low' columns.

        Expects columns: open, high, low, close, volume
        """
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        lookback = int(self.params["lookback"])
        confirm = int(self.params["confirmation_candles"])

        # Rolling high / low (shifted by 1 so current candle is not included)
        df["rolling_high"] = df["high"].shift(1).rolling(window=lookback).max()
        df["rolling_low"] = df["low"].shift(1).rolling(window=lookback).min()

        # Breakout: close exceeds the N-day high/low
        df["above_high"] = df["close"] > df["rolling_high"]
        df["below_low"] = df["close"] < df["rolling_low"]

        if confirm <= 1:
            # Instant signal on breakout candle
            df["signal"] = 0
            df.loc[df["above_high"], "signal"] = 1
            df.loc[df["below_low"], "signal"] = -1
        else:
            # Require `confirm` consecutive candles above/below
            df["consec_above"] = (
                df["above_high"]
                .rolling(window=confirm)
                .sum()
                .eq(confirm)
            )
            df["consec_below"] = (
                df["below_low"]
                .rolling(window=confirm)
                .sum()
                .eq(confirm)
            )
            # Signal fires only on the candle that completes the confirmation
            prev_consec_above = df["consec_above"].shift(1).fillna(False)
            prev_consec_below = df["consec_below"].shift(1).fillna(False)

            df["signal"] = 0
            df.loc[df["consec_above"] & ~prev_consec_above, "signal"] = 1
            df.loc[df["consec_below"] & ~prev_consec_below, "signal"] = -1

            df.drop(columns=["consec_above", "consec_below"], inplace=True)

        df.drop(columns=["above_high", "below_low"], inplace=True)
        return df
