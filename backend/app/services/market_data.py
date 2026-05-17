import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List, Tuple
from functools import lru_cache

import pandas as pd
import numpy as np
import yfinance as yf
import httpx

from app.config import settings
from app.utils.helpers import (
    normalize_symbol,
    strip_exchange_suffix,
    timeframe_to_yfinance_interval,
    timeframe_to_yfinance_period,
)

logger = logging.getLogger(__name__)

# NSE indices and their yfinance tickers
NSE_INDICES = {
    "NIFTY 50": "^NSEI",
    "NIFTY BANK": "^NSEBANK",
    "NIFTY IT": "^CNXIT",
    "NIFTY PHARMA": "^CNXPHARMA",
    "NIFTY AUTO": "^CNXAUTO",
    "NIFTY FMCG": "^CNXFMCG",
    "NIFTY METAL": "^CNXMETAL",
    "NIFTY REALTY": "^CNXREALTY",
    "SENSEX": "^BSESN",
    "INDIA VIX": "^INDIAVIX",
}

# Top Nifty 50 stocks
NIFTY50_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
    "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "BAJFINANCE",
    "KOTAKBANK", "LT", "ASIANPAINT", "AXISBANK", "MARUTI",
    "SUNPHARMA", "TITAN", "ULTRACEMCO", "WIPRO", "NESTLEIND",
    "POWERGRID", "TECHM", "BAJAJFINSV", "ONGC", "HCLTECH",
    "INDUSINDBK", "COALINDIA", "NTPC", "TATAMOTORS", "CIPLA",
    "JSWSTEEL", "TATASTEEL", "M&M", "DRREDDY", "BPCL",
    "BRITANNIA", "ADANIPORTS", "DIVISLAB", "EICHERMOT", "GRASIM",
    "HEROMOTOCO", "HINDALCO", "IOC", "SBILIFE", "SHREECEM",
    "TATACONSUM", "BAJAJ-AUTO", "APOLLOHOSP", "HDFC", "ADANIENT",
]


class MarketDataService:
    """
    Centralized market data service.
    Uses yfinance as primary fallback when broker APIs aren't configured.
    Implements caching to avoid rate limits.
    """

    def __init__(self):
        self._cache: Dict[str, Tuple[Any, datetime]] = {}
        self._cache_ttl_seconds = 15  # 15 seconds for live quotes
        self._candle_cache_ttl = 60   # 1 minute for candles

    def _is_cache_valid(self, key: str, ttl: int = None) -> bool:
        if key not in self._cache:
            return False
        _, cached_at = self._cache[key]
        ttl = ttl or self._cache_ttl_seconds
        return (datetime.utcnow() - cached_at).total_seconds() < ttl

    def _get_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            data, _ = self._cache[key]
            return data
        return None

    def _set_cache(self, key: str, data: Any) -> None:
        self._cache[key] = (data, datetime.utcnow())

    async def fetch_quote(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """
        Fetch live quote for a symbol.
        Returns standardized quote dict.
        """
        cache_key = f"quote:{symbol}:{exchange}"
        if self._is_cache_valid(cache_key):
            return self._get_cache(cache_key)

        try:
            yf_symbol = normalize_symbol(symbol, exchange)
            ticker = await asyncio.to_thread(yf.Ticker, yf_symbol)
            info = await asyncio.to_thread(lambda: ticker.info)
            hist = await asyncio.to_thread(
                lambda: ticker.history(period="2d", interval="1m")
            )

            if hist.empty:
                return self._empty_quote(symbol, exchange)

            latest = hist.iloc[-1]
            prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose", 0)
            current_price = latest["Close"]
            change = current_price - prev_close if prev_close else 0
            change_pct = (change / prev_close * 100) if prev_close else 0

            quote = {
                "symbol": symbol.upper(),
                "exchange": exchange.upper(),
                "name": info.get("longName") or info.get("shortName", symbol),
                "price": round(current_price, 2),
                "open": round(float(latest.get("Open", 0)), 2),
                "high": round(float(latest.get("High", 0)), 2),
                "low": round(float(latest.get("Low", 0)), 2),
                "prev_close": round(float(prev_close), 2),
                "change": round(float(change), 2),
                "change_percent": round(float(change_pct), 2),
                "volume": int(latest.get("Volume", 0)),
                "avg_volume": int(info.get("averageVolume", 0)),
                "market_cap": info.get("marketCap"),
                "pe_ratio": info.get("trailingPE"),
                "pb_ratio": info.get("priceToBook"),
                "dividend_yield": info.get("dividendYield"),
                "52w_high": info.get("fiftyTwoWeekHigh"),
                "52w_low": info.get("fiftyTwoWeekLow"),
                "timestamp": datetime.utcnow().isoformat(),
                "source": "yfinance",
            }

            self._set_cache(cache_key, quote)
            return quote

        except Exception as e:
            logger.error(f"Error fetching quote for {symbol}: {e}")
            return self._empty_quote(symbol, exchange)

    def _empty_quote(self, symbol: str, exchange: str) -> Dict[str, Any]:
        return {
            "symbol": symbol.upper(),
            "exchange": exchange.upper(),
            "price": 0.0,
            "change": 0.0,
            "change_percent": 0.0,
            "error": "Data unavailable",
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def fetch_candles(
        self,
        symbol: str,
        timeframe: str = "15m",
        exchange: str = "NSE",
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 200,
    ) -> List[Dict[str, Any]]:
        """
        Fetch OHLCV candle data.
        Returns list of candle dicts with timestamp, open, high, low, close, volume.
        """
        cache_key = f"candles:{symbol}:{exchange}:{timeframe}"
        if self._is_cache_valid(cache_key, self._candle_cache_ttl):
            cached = self._get_cache(cache_key)
            if cached:
                return cached

        try:
            yf_symbol = normalize_symbol(symbol, exchange)
            interval = timeframe_to_yfinance_interval(timeframe)
            period = timeframe_to_yfinance_period(timeframe, limit)

            ticker = yf.Ticker(yf_symbol)

            if from_date and to_date:
                hist = await asyncio.to_thread(
                    lambda: ticker.history(
                        start=from_date.strftime("%Y-%m-%d"),
                        end=to_date.strftime("%Y-%m-%d"),
                        interval=interval,
                    )
                )
            else:
                hist = await asyncio.to_thread(
                    lambda: ticker.history(period=period, interval=interval)
                )

            if hist.empty:
                return []

            # Normalize columns
            hist.index = pd.to_datetime(hist.index)
            if hist.index.tz is not None:
                hist.index = hist.index.tz_convert("Asia/Kolkata")

            candles = []
            for ts, row in hist.tail(limit).iterrows():
                candles.append({
                    "timestamp": ts.isoformat(),
                    "open": round(float(row["Open"]), 2),
                    "high": round(float(row["High"]), 2),
                    "low": round(float(row["Low"]), 2),
                    "close": round(float(row["Close"]), 2),
                    "volume": int(row.get("Volume", 0)),
                })

            self._set_cache(cache_key, candles)
            return candles

        except Exception as e:
            logger.error(f"Error fetching candles for {symbol}: {e}", exc_info=True)
            return []

    async def fetch_candles_as_dataframe(
        self,
        symbol: str,
        timeframe: str = "15m",
        exchange: str = "NSE",
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        limit: int = 500,
    ) -> Optional[pd.DataFrame]:
        """Fetch candles and return as a pandas DataFrame with lowercase column names."""
        candles = await self.fetch_candles(symbol, timeframe, exchange, from_date, to_date, limit)
        if not candles:
            return None

        df = pd.DataFrame(candles)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df.set_index("timestamp", inplace=True)
        return df

    async def get_top_gainers(
        self, exchange: str = "NSE", limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Fetch top gaining stocks from the universe."""
        cache_key = f"gainers:{exchange}"
        if self._is_cache_valid(cache_key, 300):  # 5 minutes
            return self._get_cache(cache_key)

        quotes = await self._fetch_multiple_quotes(NIFTY50_STOCKS, exchange)
        gainers = sorted(
            [q for q in quotes if q.get("change_percent", 0) > 0],
            key=lambda x: x.get("change_percent", 0),
            reverse=True,
        )[:limit]

        self._set_cache(cache_key, gainers)
        return gainers

    async def get_top_losers(
        self, exchange: str = "NSE", limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Fetch top losing stocks from the universe."""
        cache_key = f"losers:{exchange}"
        if self._is_cache_valid(cache_key, 300):
            return self._get_cache(cache_key)

        quotes = await self._fetch_multiple_quotes(NIFTY50_STOCKS, exchange)
        losers = sorted(
            [q for q in quotes if q.get("change_percent", 0) < 0],
            key=lambda x: x.get("change_percent", 0),
        )[:limit]

        self._set_cache(cache_key, losers)
        return losers

    async def _fetch_multiple_quotes(
        self, symbols: List[str], exchange: str, batch_size: int = 10
    ) -> List[Dict[str, Any]]:
        """Fetch quotes for multiple symbols using yfinance batch download."""
        try:
            yf_symbols = [normalize_symbol(s, exchange) for s in symbols]
            data = await asyncio.to_thread(
                lambda: yf.download(
                    yf_symbols,
                    period="2d",
                    interval="1d",
                    group_by="ticker",
                    auto_adjust=True,
                    threads=True,
                    progress=False,
                )
            )

            quotes = []
            for symbol in symbols:
                try:
                    yf_sym = normalize_symbol(symbol, exchange)
                    if len(symbols) > 1:
                        sym_data = data[yf_sym] if yf_sym in data.columns.get_level_values(0) else None
                    else:
                        sym_data = data

                    if sym_data is None or sym_data.empty:
                        continue

                    latest = sym_data.iloc[-1]
                    prev = sym_data.iloc[-2] if len(sym_data) > 1 else sym_data.iloc[-1]

                    current = float(latest["Close"])
                    previous = float(prev["Close"])
                    change = current - previous
                    change_pct = (change / previous * 100) if previous else 0

                    quotes.append({
                        "symbol": symbol,
                        "exchange": exchange,
                        "price": round(current, 2),
                        "change": round(change, 2),
                        "change_percent": round(change_pct, 2),
                        "volume": int(latest.get("Volume", 0)),
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                except Exception as sym_err:
                    logger.debug(f"Skip {symbol}: {sym_err}")

            return quotes

        except Exception as e:
            logger.error(f"Batch quote fetch failed: {e}")
            # Fall back to individual fetches
            tasks = [self.fetch_quote(s, exchange) for s in symbols[:10]]
            return await asyncio.gather(*tasks, return_exceptions=False)

    async def get_market_breadth(self, exchange: str = "NSE") -> Dict[str, Any]:
        """Calculate market breadth indicators."""
        cache_key = f"breadth:{exchange}"
        if self._is_cache_valid(cache_key, 300):
            return self._get_cache(cache_key)

        quotes = await self._fetch_multiple_quotes(NIFTY50_STOCKS, exchange)

        advancing = sum(1 for q in quotes if q.get("change_percent", 0) > 0)
        declining = sum(1 for q in quotes if q.get("change_percent", 0) < 0)
        unchanged = len(quotes) - advancing - declining

        breadth = {
            "exchange": exchange,
            "total_stocks": len(quotes),
            "advancing": advancing,
            "declining": declining,
            "unchanged": unchanged,
            "advance_decline_ratio": round(advancing / max(declining, 1), 2),
            "breadth_percent": round(advancing / max(len(quotes), 1) * 100, 2),
            "timestamp": datetime.utcnow().isoformat(),
        }

        self._set_cache(cache_key, breadth)
        return breadth

    async def get_indices(self) -> List[Dict[str, Any]]:
        """Fetch major Indian market indices."""
        cache_key = "indices"
        if self._is_cache_valid(cache_key, 60):
            return self._get_cache(cache_key)

        indices = []
        for name, yf_symbol in NSE_INDICES.items():
            try:
                ticker = yf.Ticker(yf_symbol)
                hist = await asyncio.to_thread(
                    lambda t=ticker: t.history(period="2d", interval="1d")
                )
                if hist.empty or len(hist) < 1:
                    continue

                latest = hist.iloc[-1]
                prev = hist.iloc[-2] if len(hist) > 1 else hist.iloc[-1]
                current = float(latest["Close"])
                previous = float(prev["Close"])
                change = current - previous
                change_pct = (change / previous * 100) if previous else 0

                indices.append({
                    "name": name,
                    "symbol": yf_symbol,
                    "price": round(current, 2),
                    "change": round(change, 2),
                    "change_percent": round(change_pct, 2),
                    "high": round(float(latest["High"]), 2),
                    "low": round(float(latest["Low"]), 2),
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except Exception as e:
                logger.debug(f"Failed to fetch index {name}: {e}")

        self._set_cache(cache_key, indices)
        return indices

    async def search_symbols(self, query: str, exchange: str = "NSE") -> List[Dict[str, Any]]:
        """Search for stock symbols matching a query string."""
        query_upper = query.upper()
        results = []

        # Search in our known stocks list
        for symbol in NIFTY50_STOCKS:
            if query_upper in symbol:
                results.append({
                    "symbol": symbol,
                    "exchange": exchange,
                    "name": symbol,
                    "type": "EQ",
                })

        # Also try yfinance search
        try:
            yf_sym = normalize_symbol(query, exchange)
            ticker = yf.Ticker(yf_sym)
            info = await asyncio.to_thread(lambda: ticker.info)
            if info.get("regularMarketPrice") or info.get("currentPrice"):
                results.insert(0, {
                    "symbol": strip_exchange_suffix(yf_sym),
                    "exchange": exchange,
                    "name": info.get("longName", query),
                    "type": info.get("quoteType", "EQ"),
                    "sector": info.get("sector"),
                })
        except Exception:
            pass

        return results[:20]

    async def get_option_chain(
        self, symbol: str, expiry: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch option chain for a symbol.
        Returns calls and puts with strikes, OI, IV, greeks.
        """
        try:
            yf_sym = normalize_symbol(symbol, "NSE")
            ticker = yf.Ticker(yf_sym)
            expiries = await asyncio.to_thread(lambda: ticker.options)

            if not expiries:
                return {"error": "No options data available", "symbol": symbol}

            target_expiry = expiry if expiry in expiries else expiries[0]
            chain = await asyncio.to_thread(lambda: ticker.option_chain(target_expiry))

            spot_price = 0.0
            try:
                info = await asyncio.to_thread(lambda: ticker.info)
                spot_price = float(info.get("regularMarketPrice", 0) or info.get("currentPrice", 0))
            except Exception:
                pass

            def process_options(df: pd.DataFrame, opt_type: str) -> List[Dict]:
                result = []
                for _, row in df.iterrows():
                    result.append({
                        "strike": float(row.get("strike", 0)),
                        "expiry": target_expiry,
                        "type": opt_type,
                        "last_price": round(float(row.get("lastPrice", 0)), 2),
                        "change": round(float(row.get("change", 0)), 2),
                        "bid": round(float(row.get("bid", 0)), 2),
                        "ask": round(float(row.get("ask", 0)), 2),
                        "volume": int(row.get("volume", 0) or 0),
                        "open_interest": int(row.get("openInterest", 0) or 0),
                        "implied_volatility": round(float(row.get("impliedVolatility", 0) or 0) * 100, 2),
                        "in_the_money": bool(row.get("inTheMoney", False)),
                    })
                return result

            calls = process_options(chain.calls, "CE")
            puts = process_options(chain.puts, "PE")

            return {
                "symbol": symbol.upper(),
                "spot_price": spot_price,
                "expiry": target_expiry,
                "available_expiries": list(expiries),
                "calls": calls,
                "puts": puts,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Error fetching option chain for {symbol}: {e}")
            return {"error": str(e), "symbol": symbol}

    async def calculate_pcr(self, symbol: str) -> Dict[str, Any]:
        """Calculate Put-Call Ratio for a symbol."""
        chain_data = await self.get_option_chain(symbol)
        if "error" in chain_data:
            return chain_data

        calls = chain_data.get("calls", [])
        puts = chain_data.get("puts", [])

        total_call_oi = sum(c.get("open_interest", 0) for c in calls)
        total_put_oi = sum(p.get("open_interest", 0) for p in puts)
        total_call_vol = sum(c.get("volume", 0) for c in calls)
        total_put_vol = sum(p.get("volume", 0) for p in puts)

        pcr_oi = round(total_put_oi / max(total_call_oi, 1), 3)
        pcr_vol = round(total_put_vol / max(total_call_vol, 1), 3)

        # Interpretation
        if pcr_oi > 1.2:
            sentiment = "Bullish (high put writing)"
        elif pcr_oi < 0.7:
            sentiment = "Bearish (high call writing)"
        else:
            sentiment = "Neutral"

        return {
            "symbol": symbol.upper(),
            "pcr_oi": pcr_oi,
            "pcr_volume": pcr_vol,
            "total_call_oi": total_call_oi,
            "total_put_oi": total_put_oi,
            "total_call_volume": total_call_vol,
            "total_put_volume": total_put_vol,
            "sentiment": sentiment,
            "expiry": chain_data.get("expiry"),
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def calculate_max_pain(self, symbol: str) -> Dict[str, Any]:
        """
        Calculate Max Pain (the strike price where most options expire worthless).
        """
        chain_data = await self.get_option_chain(symbol)
        if "error" in chain_data:
            return chain_data

        calls = chain_data.get("calls", [])
        puts = chain_data.get("puts", [])
        spot = chain_data.get("spot_price", 0)

        # Get all unique strikes
        all_strikes = sorted(set(
            [c["strike"] for c in calls] + [p["strike"] for p in puts]
        ))

        if not all_strikes:
            return {"error": "No strike data", "symbol": symbol}

        call_oi = {c["strike"]: c["open_interest"] for c in calls}
        put_oi = {p["strike"]: p["open_interest"] for p in puts}

        min_pain = float("inf")
        max_pain_strike = spot

        for test_strike in all_strikes:
            total_pain = 0

            # Pain from calls (holders lose if price < strike)
            for strike in all_strikes:
                if test_strike > strike:
                    total_pain += (test_strike - strike) * call_oi.get(strike, 0)

            # Pain from puts (holders lose if price > strike)
            for strike in all_strikes:
                if test_strike < strike:
                    total_pain += (strike - test_strike) * put_oi.get(strike, 0)

            if total_pain < min_pain:
                min_pain = total_pain
                max_pain_strike = test_strike

        return {
            "symbol": symbol.upper(),
            "max_pain_strike": max_pain_strike,
            "spot_price": spot,
            "difference": round(spot - max_pain_strike, 2),
            "difference_percent": round((spot - max_pain_strike) / max(spot, 1) * 100, 2),
            "expiry": chain_data.get("expiry"),
            "timestamp": datetime.utcnow().isoformat(),
        }


# Global service instance
market_data_service = MarketDataService()
