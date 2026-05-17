"""
Option Buyer Strategy
---------------------
Logic (simulated on underlying price, options treated as directional multipliers):
- Buy CE (Call) : strong bullish setup  (fast EMA > slow EMA AND RSI > 55)
- Buy PE (Put)  : strong bearish setup  (fast EMA < slow EMA AND RSI < 45)
- Exit on 50% profit or 30% loss from option entry premium
- Parameters:
    fast_ema      (int,   default 9)
    slow_ema      (int,   default 21)
    rsi_period    (int,   default 14)
    rsi_bull      (float, default 55)  – RSI threshold for bullish signal
    rsi_bear      (float, default 45)  – RSI threshold for bearish signal
    profit_target (float, default 50)  – exit at N% profit on premium
    stop_loss     (float, default 30)  – exit at N% loss on premium
    expiry_days   (int,   default 7)
    otm_strikes   (int,   default 1)   – number of strikes OTM
"""

import pandas as pd
import numpy as np

from app.strategies.base import BaseStrategy


class OptionBuyerStrategy(BaseStrategy):
    """
    Directional option buying using EMA + RSI confirmation.

    The 'signal' column represents the directional bias on the underlying.
    A separate column 'option_type' indicates CE or PE.
    """

    def __init__(self, params: dict = None):
        params = params or {}
        defaults = {
            "fast_ema": 9,
            "slow_ema": 21,
            "rsi_period": 14,
            "rsi_bull": 55.0,
            "rsi_bear": 45.0,
            "profit_target": 50.0,
            "stop_loss": 30.0,
            "expiry_days": 7,
            "otm_strikes": 1,
        }
        defaults.update(params)
        super().__init__(defaults)
        self.name = "Option Buyer"

    def _rsi(self, close: pd.Series, period: int) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0)
        loss = (-delta).clip(lower=0)
        avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        return 100 - (100 / (1 + rs))

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add 'signal', 'option_type', 'ema_fast', 'ema_slow', 'rsi' columns.

        Expects columns: open, high, low, close, volume
        """
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        fast = int(self.params["fast_ema"])
        slow = int(self.params["slow_ema"])
        rsi_period = int(self.params["rsi_period"])
        rsi_bull = float(self.params["rsi_bull"])
        rsi_bear = float(self.params["rsi_bear"])

        df["ema_fast"] = df["close"].ewm(span=fast, adjust=False).mean()
        df["ema_slow"] = df["close"].ewm(span=slow, adjust=False).mean()
        df["rsi"] = self._rsi(df["close"], rsi_period)

        # Strong bullish: fast > slow AND RSI above bull threshold
        bullish = (df["ema_fast"] > df["ema_slow"]) & (df["rsi"] > rsi_bull)
        # Strong bearish: fast < slow AND RSI below bear threshold
        bearish = (df["ema_fast"] < df["ema_slow"]) & (df["rsi"] < rsi_bear)

        # Fire signal only on the first candle of each new regime
        prev_bullish = bullish.shift(1).fillna(False)
        prev_bearish = bearish.shift(1).fillna(False)

        new_bull = bullish & ~prev_bullish
        new_bear = bearish & ~prev_bearish

        df["signal"] = 0
        df.loc[new_bull, "signal"] = 1   # Buy CE
        df.loc[new_bear, "signal"] = -1  # Buy PE

        df["option_type"] = "NONE"
        df.loc[new_bull, "option_type"] = "CE"
        df.loc[new_bear, "option_type"] = "PE"

        return df

    def get_exit_params(self) -> dict:
        """Return option-specific exit thresholds."""
        return {
            "profit_target_pct": float(self.params["profit_target"]),
            "stop_loss_pct": float(self.params["stop_loss"]),
        }
