from abc import ABC, abstractmethod
import pandas as pd


class BaseStrategy(ABC):
    """Abstract base class for all trading strategies."""

    def __init__(self, params: dict):
        self.params = params
        self.name = "BaseStrategy"

    @abstractmethod
    def generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Generate trading signals from OHLCV data.

        Must add a 'signal' column to the DataFrame:
            1  = BUY
           -1  = SELL
            0  = HOLD

        Parameters
        ----------
        data : pd.DataFrame
            DataFrame with columns: open, high, low, close, volume

        Returns
        -------
        pd.DataFrame
            Original DataFrame with 'signal' column added.
        """
        pass

    def get_entry_condition(self, row) -> bool:
        """Return True if the row satisfies the entry (BUY) condition."""
        return row.get("signal", 0) == 1

    def get_exit_condition(self, row) -> bool:
        """Return True if the row satisfies the exit (SELL) condition."""
        return row.get("signal", 0) == -1

    def validate_params(self, required_keys: list) -> None:
        """Validate that all required parameters are present."""
        missing = [k for k in required_keys if k not in self.params]
        if missing:
            raise ValueError(f"Missing required parameters for {self.name}: {missing}")

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} params={self.params}>"
