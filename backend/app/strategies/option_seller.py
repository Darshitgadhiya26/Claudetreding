"""
Option Seller Strategy – Iron Condor
-------------------------------------
Sell OTM CE + OTM PE around the current price to collect premium.
- Entry : Sell CE at (ATM + wing_width) and PE at (ATM - wing_width)
- Exit  : Close both legs when combined profit reaches 50 % of premium collected
          OR combined loss reaches max_loss_multiplier × premium collected
- Parameters:
    wing_width          (float, default 100)  – distance from ATM in rupees/points
    profit_target_pct   (float, default 50)   – exit at this % of premium collected
    max_loss_multiplier (float, default 2)    – exit when loss = N× premium
    iv_threshold        (float, default 20)   – minimum IV % to justify selling
"""

import pandas as pd
import numpy as np

from app.strategies.base import BaseStrategy


class OptionSellerStrategy(BaseStrategy):
    """
    Iron Condor / option-selling strategy.

    Since this simulator works on underlying OHLCV data, we model entry/exit
    purely on the underlying price relative to the short strikes.  The 'signal'
    column mirrors direction convention:
        1  = enter condor (sell strangle)
       -1  = exit / close condor
        0  = hold

    'ce_strike' and 'pe_strike' columns indicate the sold strikes.
    """

    def __init__(self, params: dict = None):
        params = params or {}
        defaults = {
            "wing_width": 100.0,
            "profit_target_pct": 50.0,
            "max_loss_multiplier": 2.0,
            "iv_threshold": 15.0,
            "round_to": 50.0,  # Round ATM to nearest N (Nifty = 50, BankNifty = 100)
        }
        defaults.update(params)
        super().__init__(defaults)
        self.name = "Option Seller (Iron Condor)"

    def _round_strike(self, price: float) -> float:
        """Round price to nearest strike interval."""
        rnd = float(self.params["round_to"])
        return round(price / rnd) * rnd

    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Add 'signal', 'ce_strike', 'pe_strike', 'atm_strike' columns.

        Strategy enters a condor at the open of each session and holds
        until profit/loss targets are met.  For backtesting simplicity,
        signals are generated once per day (first candle of the day).

        Expects columns: open, high, low, close, volume
        and optionally a 'date' / DatetimeIndex for session detection.
        """
        df = data.copy()
        df.columns = [c.lower() for c in df.columns]

        wing = float(self.params["wing_width"])

        # ── ATM approximation ──────────────────────────────────────────────
        df["atm_strike"] = df["open"].apply(self._round_strike)
        df["ce_strike"] = df["atm_strike"] + wing
        df["pe_strike"] = df["atm_strike"] - wing

        # ── Detect start of each new session (day) ─────────────────────────
        if isinstance(df.index, pd.DatetimeIndex):
            df["date"] = df.index.date
        elif "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"]).dt.date
        else:
            # Treat every row as its own session (fallback for daily data)
            df["date"] = range(len(df))

        df["new_session"] = df["date"] != df["date"].shift(1)

        # ── Entry on first candle of each session ──────────────────────────
        df["signal"] = 0
        df.loc[df["new_session"], "signal"] = 1  # Sell strangle

        # ── Exit detection: price breaches either short strike ─────────────
        # If underlying closes beyond either short strike, mark exit
        breach_ce = df["close"] > df["ce_strike"]
        breach_pe = df["close"] < df["pe_strike"]
        df.loc[breach_ce | breach_pe, "signal"] = -1

        # A new-session entry overrides a breach from the same row
        df.loc[df["new_session"] & (breach_ce | breach_pe), "signal"] = -1

        df.drop(columns=["new_session", "date"], inplace=True)
        return df

    def get_exit_params(self) -> dict:
        return {
            "profit_target_pct": float(self.params["profit_target_pct"]),
            "max_loss_multiplier": float(self.params["max_loss_multiplier"]),
        }
