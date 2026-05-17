"""
Zerodha KiteConnect Integration
================================
Uses kiteconnect SDK when credentials are present.
Falls back to yfinance for read-only market data.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from app.config import settings
from app.utils.helpers import normalize_symbol

logger = logging.getLogger(__name__)


class ZerodhaIntegration:
    """
    Wrapper around Zerodha KiteConnect API.
    All order placement / account methods are no-ops when not configured.
    Market data calls fall back to yfinance.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        access_token: Optional[str] = None,
    ):
        self.api_key = api_key or settings.ZERODHA_API_KEY
        self.api_secret = api_secret or settings.ZERODHA_API_SECRET
        self.access_token = access_token or settings.ZERODHA_ACCESS_TOKEN
        self._kite = None
        self._is_configured = bool(self.api_key and self.api_secret)

        if self._is_configured:
            self._init_kite()

    def _init_kite(self) -> None:
        """Initialise KiteConnect client."""
        try:
            from kiteconnect import KiteConnect  # type: ignore
            self._kite = KiteConnect(api_key=self.api_key)
            if self.access_token:
                self._kite.set_access_token(self.access_token)
                logger.info("Zerodha KiteConnect initialised with access token.")
            else:
                logger.warning("Zerodha: no access token set. Call generate_session() first.")
        except ImportError:
            logger.warning("kiteconnect package not installed. Using yfinance fallback.")
        except Exception as e:
            logger.error(f"Zerodha init error: {e}")

    # ── Auth ───────────────────────────────────────────────────────────────

    def get_login_url(self) -> str:
        """Return the Zerodha login URL for OAuth flow."""
        if self._kite:
            return self._kite.login_url()
        return f"https://kite.zerodha.com/connect/login?api_key={self.api_key or 'NOT_CONFIGURED'}"

    async def generate_session(self, request_token: str) -> Dict[str, Any]:
        """Exchange request_token for access_token."""
        if not self._kite:
            return {"error": "KiteConnect not initialised"}
        try:
            data = await asyncio.to_thread(
                self._kite.generate_session, request_token, api_secret=self.api_secret
            )
            self.access_token = data["access_token"]
            self._kite.set_access_token(self.access_token)
            return {
                "access_token": self.access_token,
                "user_id": data.get("user_id"),
                "user_name": data.get("user_name"),
                "broker": "zerodha",
            }
        except Exception as e:
            logger.error(f"Zerodha generate_session error: {e}")
            return {"error": str(e)}

    # ── Market Data ────────────────────────────────────────────────────────

    async def get_quote(self, symbols: List[str]) -> Dict[str, Any]:
        """Fetch live quote for a list of NSE symbols."""
        if self._kite and self.access_token:
            try:
                instruments = [f"NSE:{s}" for s in symbols]
                quotes = await asyncio.to_thread(self._kite.quote, instruments)
                return quotes
            except Exception as e:
                logger.warning(f"Zerodha quote failed, falling back: {e}")

        # yfinance fallback
        from app.services.market_data import market_data_service
        results = {}
        for sym in symbols:
            results[sym] = await market_data_service.fetch_quote(sym, "NSE")
        return results

    async def get_historical_data(
        self,
        instrument_token: str,
        from_date: datetime,
        to_date: datetime,
        interval: str = "15minute",
        continuous: bool = False,
    ) -> List[Dict]:
        """Fetch OHLCV historical data."""
        if self._kite and self.access_token:
            try:
                data = await asyncio.to_thread(
                    self._kite.historical_data,
                    instrument_token,
                    from_date,
                    to_date,
                    interval,
                    continuous,
                )
                return data
            except Exception as e:
                logger.warning(f"Zerodha historical_data failed: {e}")

        # yfinance fallback
        from app.services.market_data import market_data_service
        interval_map = {
            "minute": "1m", "3minute": "3m", "5minute": "5m",
            "15minute": "15m", "30minute": "30m", "60minute": "1h",
            "day": "1d",
        }
        tf = interval_map.get(interval, "15m")
        candles = await market_data_service.fetch_candles(
            instrument_token, tf, "NSE", from_date, to_date
        )
        return candles

    # ── Orders ─────────────────────────────────────────────────────────────

    async def place_order(
        self,
        symbol: str,
        transaction_type: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
        trigger_price: float = 0.0,
        stoploss: float = 0.0,
        validity: str = "DAY",
    ) -> Dict[str, Any]:
        """
        Place an order via Zerodha.
        Returns order_id on success.
        """
        if not self._kite or not self.access_token:
            logger.warning("Zerodha not configured. Order placement unavailable.")
            return {
                "error": "Zerodha API not configured. Please set ZERODHA_API_KEY and access_token.",
                "simulated": True,
                "symbol": symbol,
                "transaction_type": transaction_type,
                "quantity": quantity,
            }

        try:
            from kiteconnect import KiteConnect  # type: ignore
            tt = (
                KiteConnect.TRANSACTION_TYPE_BUY
                if transaction_type.upper() == "BUY"
                else KiteConnect.TRANSACTION_TYPE_SELL
            )
            ot_map = {
                "MARKET": KiteConnect.ORDER_TYPE_MARKET,
                "LIMIT": KiteConnect.ORDER_TYPE_LIMIT,
                "SL": KiteConnect.ORDER_TYPE_SL,
                "SL-M": KiteConnect.ORDER_TYPE_SLM,
            }
            product_map = {
                "MIS": KiteConnect.PRODUCT_MIS,
                "CNC": KiteConnect.PRODUCT_CNC,
                "NRML": KiteConnect.PRODUCT_NRML,
            }
            order_id = await asyncio.to_thread(
                self._kite.place_order,
                variety=KiteConnect.VARIETY_REGULAR,
                exchange=exchange,
                tradingsymbol=symbol,
                transaction_type=tt,
                quantity=quantity,
                product=product_map.get(product, KiteConnect.PRODUCT_MIS),
                order_type=ot_map.get(order_type, KiteConnect.ORDER_TYPE_MARKET),
                price=price if price else None,
                trigger_price=trigger_price if trigger_price else None,
                validity=validity,
            )
            return {"order_id": order_id, "status": "placed", "broker": "zerodha"}

        except Exception as e:
            logger.error(f"Zerodha place_order error: {e}")
            return {"error": str(e)}

    async def get_orders(self) -> List[Dict]:
        """Fetch all orders for today."""
        if not self._kite or not self.access_token:
            return []
        try:
            return await asyncio.to_thread(self._kite.orders)
        except Exception as e:
            logger.error(f"Zerodha get_orders error: {e}")
            return []

    async def get_positions(self) -> Dict[str, Any]:
        """Fetch current positions."""
        if not self._kite or not self.access_token:
            return {"day": [], "net": []}
        try:
            return await asyncio.to_thread(self._kite.positions)
        except Exception as e:
            logger.error(f"Zerodha get_positions error: {e}")
            return {"day": [], "net": []}

    async def get_holdings(self) -> List[Dict]:
        """Fetch long-term holdings (CNC positions)."""
        if not self._kite or not self.access_token:
            return []
        try:
            return await asyncio.to_thread(self._kite.holdings)
        except Exception as e:
            logger.error(f"Zerodha get_holdings error: {e}")
            return []

    async def cancel_order(self, order_id: str, variety: str = "regular") -> Dict[str, Any]:
        """Cancel an open order."""
        if not self._kite or not self.access_token:
            return {"error": "Not configured"}
        try:
            result = await asyncio.to_thread(
                self._kite.cancel_order, variety=variety, order_id=order_id
            )
            return {"order_id": result, "status": "cancelled"}
        except Exception as e:
            logger.error(f"Zerodha cancel_order error: {e}")
            return {"error": str(e)}

    async def get_margins(self) -> Dict[str, Any]:
        """Fetch available margins."""
        if not self._kite or not self.access_token:
            return {}
        try:
            return await asyncio.to_thread(self._kite.margins)
        except Exception as e:
            logger.error(f"Zerodha get_margins error: {e}")
            return {}

    @property
    def is_configured(self) -> bool:
        return self._is_configured

    @property
    def is_authenticated(self) -> bool:
        return bool(self._kite and self.access_token)
