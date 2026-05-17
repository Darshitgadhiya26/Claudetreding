"""
Upstox V2 API Integration
==========================
Uses official upstox-python-sdk when configured.
Falls back to yfinance for market data.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.config import settings
from app.utils.helpers import normalize_symbol

logger = logging.getLogger(__name__)


class UpstoxIntegration:
    """
    Wrapper around Upstox V2 REST API.
    Implements order management, portfolio, and market data.
    Falls back to yfinance when credentials aren't set.
    """

    BASE_URL = "https://api.upstox.com/v2"

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        access_token: Optional[str] = None,
    ):
        self.api_key = api_key or settings.UPSTOX_API_KEY
        self.api_secret = api_secret or settings.UPSTOX_API_SECRET
        self.access_token = access_token
        self._is_configured = bool(self.api_key and self.api_secret)
        self._headers: Dict[str, str] = {}

        if self.access_token:
            self._set_headers(self.access_token)

    def _set_headers(self, token: str) -> None:
        self.access_token = token
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    # ── Auth ───────────────────────────────────────────────────────────────

    def get_login_url(self) -> str:
        """Return Upstox OAuth2 login URL."""
        redirect = settings.UPSTOX_REDIRECT_URI
        return (
            f"https://api.upstox.com/v2/login/authorization/dialog"
            f"?response_type=code&client_id={self.api_key or 'NOT_SET'}"
            f"&redirect_uri={redirect}"
        )

    async def generate_access_token(self, code: str) -> Dict[str, Any]:
        """Exchange auth code for access token."""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{self.BASE_URL}/login/authorization/token",
                    data={
                        "code": code,
                        "client_id": self.api_key,
                        "client_secret": self.api_secret,
                        "redirect_uri": settings.UPSTOX_REDIRECT_URI,
                        "grant_type": "authorization_code",
                    },
                )
                data = resp.json()
                token = data.get("access_token")
                if token:
                    self._set_headers(token)
                return data
        except Exception as e:
            logger.error(f"Upstox token exchange failed: {e}")
            return {"error": str(e)}

    # ── Market Data ────────────────────────────────────────────────────────

    async def get_quote(self, symbol: str, exchange: str = "NSE_EQ") -> Dict[str, Any]:
        """Fetch live market quote."""
        if self.access_token:
            import httpx
            try:
                instrument = f"{exchange}|{symbol}"
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.get(
                        f"{self.BASE_URL}/market-quote/quotes",
                        headers=self._headers,
                        params={"symbol": instrument},
                    )
                    if resp.status_code == 200:
                        return resp.json().get("data", {})
            except Exception as e:
                logger.warning(f"Upstox quote failed, falling back: {e}")

        # yfinance fallback
        from app.services.market_data import market_data_service
        ex = "NSE" if "NSE" in exchange else "BSE"
        return await market_data_service.fetch_quote(symbol, ex)

    async def get_historical_data(
        self,
        symbol: str,
        interval: str = "30minute",
        from_date: str = "",
        to_date: str = "",
        exchange: str = "NSE_EQ",
    ) -> List[Dict]:
        """Fetch historical OHLCV candles."""
        if self.access_token:
            import httpx
            try:
                instrument = f"{exchange}|{symbol}"
                params = {
                    "symbol": instrument,
                    "interval": interval,
                    "from_date": from_date,
                    "to_date": to_date,
                }
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.get(
                        f"{self.BASE_URL}/historical-candle/{instrument}/{interval}/{to_date}/{from_date}",
                        headers=self._headers,
                        params=params,
                    )
                    if resp.status_code == 200:
                        data = resp.json().get("data", {})
                        candles = data.get("candles", [])
                        return [
                            {
                                "timestamp": c[0],
                                "open": c[1],
                                "high": c[2],
                                "low": c[3],
                                "close": c[4],
                                "volume": c[5],
                            }
                            for c in candles
                        ]
            except Exception as e:
                logger.warning(f"Upstox historical_data failed: {e}")

        # yfinance fallback
        interval_map = {
            "1minute": "1m", "5minute": "5m", "10minute": "15m",
            "30minute": "30m", "60minute": "1h", "1day": "1d",
            "1week": "1wk", "1month": "1mo",
        }
        from app.services.market_data import market_data_service
        tf = interval_map.get(interval, "30m")
        from_dt = datetime.strptime(from_date, "%Y-%m-%d") if from_date else None
        to_dt = datetime.strptime(to_date, "%Y-%m-%d") if to_date else None
        return await market_data_service.fetch_candles(symbol, tf, "NSE", from_dt, to_dt)

    # ── Orders ─────────────────────────────────────────────────────────────

    async def place_order(
        self,
        symbol: str,
        transaction_type: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "I",  # I=Intraday, D=Delivery
        exchange: str = "NSE_EQ",
        trigger_price: float = 0.0,
        validity: str = "DAY",
        is_amo: bool = False,
    ) -> Dict[str, Any]:
        """Place an order via Upstox V2 API."""
        if not self.access_token:
            return {
                "error": "Upstox not authenticated",
                "simulated": True,
                "symbol": symbol,
                "quantity": quantity,
                "transaction_type": transaction_type,
            }

        import httpx
        payload = {
            "quantity": quantity,
            "product": product,
            "validity": validity,
            "price": price,
            "tag": "trading_platform",
            "instrument_token": f"{exchange}|{symbol}",
            "order_type": order_type,
            "transaction_type": transaction_type.upper(),
            "disclosed_quantity": 0,
            "trigger_price": trigger_price,
            "is_amo": is_amo,
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.BASE_URL}/order/place",
                    headers=self._headers,
                    json=payload,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "order_id": data.get("data", {}).get("order_id"),
                        "status": "placed",
                        "broker": "upstox",
                    }
                return {"error": resp.text, "status_code": resp.status_code}
        except Exception as e:
            logger.error(f"Upstox place_order error: {e}")
            return {"error": str(e)}

    async def get_orders(self) -> List[Dict]:
        """Fetch today's orders."""
        if not self.access_token:
            return []
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/order/retrieve-all", headers=self._headers
                )
                if resp.status_code == 200:
                    return resp.json().get("data", [])
        except Exception as e:
            logger.error(f"Upstox get_orders error: {e}")
        return []

    async def get_positions(self) -> List[Dict]:
        """Fetch current open positions."""
        if not self.access_token:
            return []
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/portfolio/short-term-positions", headers=self._headers
                )
                if resp.status_code == 200:
                    return resp.json().get("data", [])
        except Exception as e:
            logger.error(f"Upstox get_positions error: {e}")
        return []

    async def get_holdings(self) -> List[Dict]:
        """Fetch long-term holdings."""
        if not self.access_token:
            return []
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/portfolio/long-term-holdings", headers=self._headers
                )
                if resp.status_code == 200:
                    return resp.json().get("data", [])
        except Exception as e:
            logger.error(f"Upstox get_holdings error: {e}")
        return []

    async def get_funds(self) -> Dict[str, Any]:
        """Fetch fund/margin details."""
        if not self.access_token:
            return {}
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/user/get-funds-and-margin", headers=self._headers
                )
                if resp.status_code == 200:
                    return resp.json().get("data", {})
        except Exception as e:
            logger.error(f"Upstox get_funds error: {e}")
        return {}

    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """Cancel an open order."""
        if not self.access_token:
            return {"error": "Not authenticated"}
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.delete(
                    f"{self.BASE_URL}/order/cancel",
                    headers=self._headers,
                    params={"order_id": order_id},
                )
                if resp.status_code == 200:
                    return {"status": "cancelled", "order_id": order_id}
                return {"error": resp.text}
        except Exception as e:
            logger.error(f"Upstox cancel_order error: {e}")
            return {"error": str(e)}

    @property
    def is_configured(self) -> bool:
        return self._is_configured

    @property
    def is_authenticated(self) -> bool:
        return bool(self.access_token)
