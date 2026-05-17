"""
Angel One (SmartAPI) Integration
==================================
Uses smartapi-python SDK when configured.
Falls back to yfinance for market data.
"""

import asyncio
import logging
import pyotp
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.config import settings
from app.utils.helpers import normalize_symbol

logger = logging.getLogger(__name__)


class AngelOneIntegration:
    """
    Wrapper around Angel One SmartAPI.
    Supports TOTP-based authentication for secure login.
    Falls back to yfinance when not configured.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        client_id: Optional[str] = None,
        password: Optional[str] = None,
        totp_secret: Optional[str] = None,
    ):
        self.api_key = api_key or settings.ANGEL_API_KEY
        self.client_id = client_id or settings.ANGEL_CLIENT_ID
        self.password = password or settings.ANGEL_PASSWORD
        self.totp_secret = totp_secret or settings.ANGEL_TOTP
        self._smart = None
        self._auth_token: Optional[str] = None
        self._is_configured = bool(
            self.api_key and self.client_id and self.password
        )

    # ── Auth ───────────────────────────────────────────────────────────────

    async def login(self) -> Dict[str, Any]:
        """
        Authenticate with Angel One SmartAPI using TOTP.
        Returns auth_token, refresh_token, feed_token.
        """
        if not self._is_configured:
            return {"error": "Angel One credentials not configured"}

        try:
            from smartapi import SmartConnect  # type: ignore
            self._smart = SmartConnect(api_key=self.api_key)

            totp_value = ""
            if self.totp_secret:
                totp_value = pyotp.TOTP(self.totp_secret).now()

            data = await asyncio.to_thread(
                self._smart.generateSession,
                self.client_id,
                self.password,
                totp_value,
            )

            if data.get("status"):
                self._auth_token = data["data"].get("jwtToken")
                logger.info(f"Angel One login successful for {self.client_id}")
                return {
                    "auth_token": self._auth_token,
                    "refresh_token": data["data"].get("refreshToken"),
                    "feed_token": data["data"].get("feedToken"),
                    "broker": "angelone",
                }
            return {"error": data.get("message", "Login failed")}

        except ImportError:
            logger.warning("smartapi-python not installed. Using yfinance fallback.")
            return {"error": "smartapi package not installed"}
        except Exception as e:
            logger.error(f"Angel One login error: {e}")
            return {"error": str(e)}

    async def refresh_session(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh the JWT session."""
        if not self._smart:
            return {"error": "Not initialised"}
        try:
            data = await asyncio.to_thread(
                self._smart.generateToken, refresh_token
            )
            if data.get("status"):
                self._auth_token = data["data"].get("jwtToken")
                return {"auth_token": self._auth_token}
            return {"error": data.get("message")}
        except Exception as e:
            logger.error(f"Angel One refresh error: {e}")
            return {"error": str(e)}

    # ── Market Data ────────────────────────────────────────────────────────

    async def get_ltp(self, exchange: str, symbol: str, token: str) -> Dict[str, Any]:
        """Get Last Traded Price."""
        if self._smart and self._auth_token:
            try:
                data = await asyncio.to_thread(
                    self._smart.ltpData, exchange, symbol, token
                )
                if data.get("status"):
                    return data["data"]
            except Exception as e:
                logger.warning(f"Angel One LTP failed: {e}")

        # yfinance fallback
        from app.services.market_data import market_data_service
        return await market_data_service.fetch_quote(symbol, exchange)

    async def get_historical_data(
        self,
        exchange: str,
        symbol_token: str,
        interval: str = "FIFTEEN_MINUTE",
        from_date: str = "",
        to_date: str = "",
    ) -> List[Dict]:
        """
        Fetch historical candle data.
        interval options: ONE_MINUTE, THREE_MINUTE, FIVE_MINUTE, TEN_MINUTE,
                          FIFTEEN_MINUTE, THIRTY_MINUTE, ONE_HOUR, ONE_DAY
        """
        if self._smart and self._auth_token:
            try:
                params = {
                    "exchange": exchange,
                    "symboltoken": symbol_token,
                    "interval": interval,
                    "fromdate": from_date,
                    "todate": to_date,
                }
                data = await asyncio.to_thread(
                    self._smart.getCandleData, params
                )
                if data.get("status"):
                    candles = []
                    for c in data.get("data", []):
                        candles.append({
                            "timestamp": c[0],
                            "open": c[1],
                            "high": c[2],
                            "low": c[3],
                            "close": c[4],
                            "volume": c[5],
                        })
                    return candles
            except Exception as e:
                logger.warning(f"Angel One historical data failed: {e}")

        # yfinance fallback
        interval_map = {
            "ONE_MINUTE": "1m", "THREE_MINUTE": "3m", "FIVE_MINUTE": "5m",
            "TEN_MINUTE": "15m", "FIFTEEN_MINUTE": "15m", "THIRTY_MINUTE": "30m",
            "ONE_HOUR": "1h", "ONE_DAY": "1d",
        }
        from app.services.market_data import market_data_service
        tf = interval_map.get(interval, "15m")
        from_dt = datetime.strptime(from_date, "%Y-%m-%d %H:%M") if from_date else None
        to_dt = datetime.strptime(to_date, "%Y-%m-%d %H:%M") if to_date else None
        return await market_data_service.fetch_candles(
            symbol_token, tf, exchange, from_dt, to_dt
        )

    # ── Orders ─────────────────────────────────────────────────────────────

    async def place_order(
        self,
        symbol: str,
        token: str,
        transaction_type: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product_type: str = "INTRADAY",
        exchange: str = "NSE",
        trigger_price: float = 0.0,
        squareoff: float = 0.0,
        stoploss: float = 0.0,
        trailing_sl: float = 0.0,
    ) -> Dict[str, Any]:
        """Place an order via Angel One SmartAPI."""
        if not self._smart or not self._auth_token:
            return {
                "error": "Angel One not authenticated",
                "simulated": True,
                "symbol": symbol,
                "quantity": quantity,
                "transaction_type": transaction_type,
            }

        order_params = {
            "variety": "NORMAL",
            "tradingsymbol": symbol,
            "symboltoken": token,
            "transactiontype": transaction_type.upper(),
            "exchange": exchange,
            "ordertype": order_type,
            "producttype": product_type,
            "duration": "DAY",
            "price": price,
            "squareoff": squareoff,
            "stoploss": stoploss,
            "trailingStopLoss": trailing_sl,
            "quantity": quantity,
            "triggerprice": trigger_price,
        }

        try:
            data = await asyncio.to_thread(self._smart.placeOrder, order_params)
            if data.get("status"):
                return {
                    "order_id": data["data"].get("orderid"),
                    "script": data["data"].get("script"),
                    "status": "placed",
                    "broker": "angelone",
                }
            return {"error": data.get("message", "Order failed")}

        except Exception as e:
            logger.error(f"Angel One place_order error: {e}")
            return {"error": str(e)}

    async def cancel_order(self, order_id: str, variety: str = "NORMAL") -> Dict[str, Any]:
        """Cancel a pending order."""
        if not self._smart or not self._auth_token:
            return {"error": "Not authenticated"}
        try:
            data = await asyncio.to_thread(
                self._smart.cancelOrder, order_id, variety
            )
            if data.get("status"):
                return {"order_id": order_id, "status": "cancelled"}
            return {"error": data.get("message")}
        except Exception as e:
            logger.error(f"Angel One cancel_order error: {e}")
            return {"error": str(e)}

    async def get_orders(self) -> List[Dict]:
        """Fetch today's order book."""
        if not self._smart or not self._auth_token:
            return []
        try:
            data = await asyncio.to_thread(self._smart.orderBook)
            return data.get("data", []) if data.get("status") else []
        except Exception as e:
            logger.error(f"Angel One get_orders error: {e}")
            return []

    async def get_positions(self) -> List[Dict]:
        """Fetch open positions."""
        if not self._smart or not self._auth_token:
            return []
        try:
            data = await asyncio.to_thread(self._smart.position)
            return data.get("data", []) if data.get("status") else []
        except Exception as e:
            logger.error(f"Angel One get_positions error: {e}")
            return []

    async def get_holdings(self) -> List[Dict]:
        """Fetch portfolio holdings."""
        if not self._smart or not self._auth_token:
            return []
        try:
            data = await asyncio.to_thread(self._smart.holding)
            return data.get("data", []) if data.get("status") else []
        except Exception as e:
            logger.error(f"Angel One get_holdings error: {e}")
            return []

    async def get_rms_limits(self) -> Dict[str, Any]:
        """Fetch RMS (Risk Management System) limits / margin."""
        if not self._smart or not self._auth_token:
            return {}
        try:
            data = await asyncio.to_thread(self._smart.rmsLimit)
            return data.get("data", {}) if data.get("status") else {}
        except Exception as e:
            logger.error(f"Angel One rmsLimit error: {e}")
            return {}

    @property
    def is_configured(self) -> bool:
        return self._is_configured

    @property
    def is_authenticated(self) -> bool:
        return bool(self._auth_token)
