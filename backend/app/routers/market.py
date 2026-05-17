"""
Market Data Router
==================
REST endpoints for Indian stock market data powered by yfinance.

Symbols convention:
  - NSE equity  : RELIANCE.NS, TCS.NS, INFY.NS
  - BSE equity  : RELIANCE.BO
  - Nifty 50    : ^NSEI
  - Bank Nifty  : ^NSEBANK
  - Sensex      : ^BSESN
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market", tags=["Market Data"])

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

NIFTY50_SYMBOLS = [
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "INFY.NS",
    "ICICIBANK.NS",
    "HINDUNILVR.NS",
    "SBIN.NS",
    "BHARTIARTL.NS",
    "BAJFINANCE.NS",
    "KOTAKBANK.NS",
    "LT.NS",
    "ASIANPAINT.NS",
    "AXISBANK.NS",
    "MARUTI.NS",
    "TITAN.NS",
    "SUNPHARMA.NS",
    "WIPRO.NS",
    "ONGC.NS",
    "POWERGRID.NS",
    "ULTRACEMCO.NS",
]

INDICES = {
    "NIFTY50": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "SENSEX": "^BSESN",
    "NIFTYIT": "^CNXIT",
    "NIFTYMIDCAP": "^NSEMDCP50",
}

TIMEFRAME_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "60m",
    "1d": "1d",
    "1w": "1wk",
}

PERIOD_FOR_TIMEFRAME = {
    "1m": "1d",
    "5m": "5d",
    "15m": "1mo",
    "30m": "1mo",
    "60m": "3mo",
    "1d": "1y",
    "1wk": "5y",
}


# ─────────────────────────────────────────────────────────────────────────────
# Response Models
# ─────────────────────────────────────────────────────────────────────────────

class Candle(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class Quote(BaseModel):
    symbol: str
    ltp: float
    open: float
    high: float
    low: float
    prev_close: float
    change: float
    change_pct: float
    volume: int
    market_cap: Optional[float] = None


class IndexData(BaseModel):
    symbol: str
    name: str
    ltp: float
    change: float
    change_pct: float


class SearchResult(BaseModel):
    symbol: str
    name: str
    exchange: str
    type: str


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _normalise_symbol(symbol: str) -> str:
    """Ensure symbol has .NS suffix for NSE equities."""
    symbol = symbol.upper().strip()
    if not symbol.startswith("^") and "." not in symbol:
        symbol = f"{symbol}.NS"
    return symbol


def _df_to_candles(df: pd.DataFrame, limit: int = 200) -> list[dict]:
    """Convert yfinance OHLCV DataFrame to list of candle dicts."""
    if df.empty:
        return []
    df = df.tail(limit)
    df.columns = [c.lower() for c in df.columns]
    candles = []
    for idx, row in df.iterrows():
        ts = idx.isoformat() if hasattr(idx, "isoformat") else str(idx)
        candles.append({
            "timestamp": ts,
            "open": round(float(row.get("open", 0)), 2),
            "high": round(float(row.get("high", 0)), 2),
            "low": round(float(row.get("low", 0)), 2),
            "close": round(float(row.get("close", 0)), 2),
            "volume": int(row.get("volume", 0)),
        })
    return candles


def _get_quote(ticker: yf.Ticker) -> dict:
    """Extract latest quote from a yfinance Ticker object."""
    info = ticker.fast_info
    try:
        ltp = float(info.last_price or 0)
        prev_close = float(info.previous_close or info.regular_market_previous_close or ltp)
        change = ltp - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0.0
        return {
            "ltp": round(ltp, 2),
            "open": round(float(info.open or 0), 2),
            "high": round(float(info.day_high or 0), 2),
            "low": round(float(info.day_low or 0), 2),
            "prev_close": round(prev_close, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "volume": int(info.three_month_average_volume or 0),
            "market_cap": info.market_cap,
        }
    except Exception as exc:
        logger.warning(f"Error extracting quote: {exc}")
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/indices", response_model=list[IndexData])
async def get_indices():
    """
    Fetch live data for major Indian indices.

    Returns Nifty50, BankNifty, Sensex, Nifty IT, and Nifty Midcap.
    """
    results = []
    for name, yf_symbol in INDICES.items():
        try:
            ticker = yf.Ticker(yf_symbol)
            quote = _get_quote(ticker)
            if quote:
                results.append(
                    IndexData(
                        symbol=yf_symbol,
                        name=name,
                        ltp=quote.get("ltp", 0),
                        change=quote.get("change", 0),
                        change_pct=quote.get("change_pct", 0),
                    )
                )
        except Exception as exc:
            logger.warning(f"Failed to fetch index {name}: {exc}")

    if not results:
        raise HTTPException(status_code=503, detail="Unable to fetch index data. Try again later.")

    return results


@router.get("/candles/{symbol}", response_model=list[Candle])
async def get_candles(
    symbol: str,
    timeframe: str = Query(default="5m", description="Candle timeframe: 1m,5m,15m,30m,1h,1d,1w"),
    limit: int = Query(default=200, ge=10, le=1000, description="Number of candles to return"),
):
    """
    Fetch OHLCV candle data for a given symbol.

    Examples:
    - /api/market/candles/RELIANCE?timeframe=5m&limit=100
    - /api/market/candles/^NSEI?timeframe=1d&limit=365
    """
    yf_symbol = _normalise_symbol(symbol)
    yf_interval = TIMEFRAME_MAP.get(timeframe, "5m")
    yf_period = PERIOD_FOR_TIMEFRAME.get(yf_interval, "5d")

    try:
        df = yf.download(
            yf_symbol,
            period=yf_period,
            interval=yf_interval,
            progress=False,
            auto_adjust=True,
        )
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for symbol: {symbol}")
        candles = _df_to_candles(df, limit=limit)
        return candles
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching candles for {symbol}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Data fetch failed: {str(exc)}")


@router.get("/quote/{symbol}", response_model=Quote)
async def get_quote(symbol: str):
    """
    Get real-time quote for a single symbol.

    Example: /api/market/quote/RELIANCE  or  /api/market/quote/RELIANCE.NS
    """
    yf_symbol = _normalise_symbol(symbol)
    try:
        ticker = yf.Ticker(yf_symbol)
        quote = _get_quote(ticker)
        if not quote:
            raise HTTPException(status_code=404, detail=f"No quote data for {symbol}")
        return Quote(symbol=yf_symbol, **quote)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching quote for {symbol}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/top-gainers")
async def get_top_gainers(limit: int = Query(default=10, ge=1, le=20)):
    """
    Return the top N gainers from the Nifty50 universe today.
    """
    return await _get_movers(top_gainers=True, limit=limit)


@router.get("/top-losers")
async def get_top_losers(limit: int = Query(default=10, ge=1, le=20)):
    """
    Return the top N losers from the Nifty50 universe today.
    """
    return await _get_movers(top_gainers=False, limit=limit)


async def _get_movers(top_gainers: bool, limit: int) -> list[dict]:
    """Fetch quotes for all Nifty50 symbols and sort by day change %."""
    movers = []
    for sym in NIFTY50_SYMBOLS:
        try:
            ticker = yf.Ticker(sym)
            quote = _get_quote(ticker)
            if quote and quote.get("ltp"):
                movers.append({"symbol": sym, **quote})
        except Exception as exc:
            logger.debug(f"Skipping {sym}: {exc}")

    movers.sort(key=lambda x: x.get("change_pct", 0), reverse=top_gainers)
    return movers[:limit]


@router.get("/search")
async def search_symbols(
    q: str = Query(..., min_length=1, description="Search query (company name or ticker)")
):
    """
    Search for NSE symbols matching the query.

    Returns up to 10 matching results from the Nifty50 universe.
    Tip: For production, integrate NSE search API or a local symbol master CSV.
    """
    query = q.strip().upper()
    # Extended search map (symbol → company name)
    symbol_master = {
        "RELIANCE": "Reliance Industries",
        "TCS": "Tata Consultancy Services",
        "HDFCBANK": "HDFC Bank",
        "INFY": "Infosys",
        "ICICIBANK": "ICICI Bank",
        "HINDUNILVR": "Hindustan Unilever",
        "SBIN": "State Bank of India",
        "BHARTIARTL": "Bharti Airtel",
        "BAJFINANCE": "Bajaj Finance",
        "KOTAKBANK": "Kotak Mahindra Bank",
        "LT": "Larsen & Toubro",
        "ASIANPAINT": "Asian Paints",
        "AXISBANK": "Axis Bank",
        "MARUTI": "Maruti Suzuki",
        "TITAN": "Titan Company",
        "SUNPHARMA": "Sun Pharmaceutical",
        "WIPRO": "Wipro",
        "ONGC": "Oil and Natural Gas Corporation",
        "POWERGRID": "Power Grid Corporation",
        "ULTRACEMCO": "UltraTech Cement",
        "NTPC": "NTPC Limited",
        "HCLTECH": "HCL Technologies",
        "TECHM": "Tech Mahindra",
        "DRREDDY": "Dr. Reddy's Laboratories",
        "CIPLA": "Cipla",
        "NESTLEIND": "Nestle India",
        "TATASTEEL": "Tata Steel",
        "TATAMOTORS": "Tata Motors",
        "ADANIENT": "Adani Enterprises",
        "ADANIPORTS": "Adani Ports",
        "JSWSTEEL": "JSW Steel",
        "DIVISLAB": "Divi's Laboratories",
        "APOLLOHOSP": "Apollo Hospitals",
        "BAJAJFINSV": "Bajaj Finserv",
        "BPCL": "Bharat Petroleum",
        "COALINDIA": "Coal India",
        "EICHERMOT": "Eicher Motors",
        "GRASIM": "Grasim Industries",
        "HDFCLIFE": "HDFC Life Insurance",
        "HEROMOTOCO": "Hero MotoCorp",
        "INDUSINDBK": "IndusInd Bank",
        "ITC": "ITC Limited",
        "M&M": "Mahindra & Mahindra",
        "SBILIFE": "SBI Life Insurance",
        "SHREECEM": "Shree Cement",
        "TATACONSUM": "Tata Consumer Products",
        "UPL": "UPL Limited",
        "VEDL": "Vedanta",
        "ZOMATO": "Zomato",
        "PAYTM": "One97 Communications",
    }

    results = []
    for ticker, name in symbol_master.items():
        if query in ticker or query in name.upper():
            results.append(
                SearchResult(
                    symbol=f"{ticker}.NS",
                    name=name,
                    exchange="NSE",
                    type="Equity",
                )
            )
            if len(results) >= 10:
                break

    return results


@router.get("/breadth")
async def get_market_breadth():
    """
    Calculate market breadth for Nifty50 universe.

    Returns advances, declines, unchanged counts and A/D ratio.
    """
    advances = declines = unchanged = 0
    total_volume = 0
    errors = 0

    for sym in NIFTY50_SYMBOLS:
        try:
            ticker = yf.Ticker(sym)
            quote = _get_quote(ticker)
            chg = quote.get("change_pct", 0)
            vol = quote.get("volume", 0)
            total_volume += vol
            if chg > 0.05:
                advances += 1
            elif chg < -0.05:
                declines += 1
            else:
                unchanged += 1
        except Exception:
            errors += 1

    total = advances + declines + unchanged
    return {
        "advances": advances,
        "declines": declines,
        "unchanged": unchanged,
        "total": total,
        "ad_ratio": round(advances / declines, 2) if declines > 0 else float("inf"),
        "advance_pct": round(advances / total * 100, 1) if total > 0 else 0,
        "total_volume": total_volume,
        "errors": errors,
        "timestamp": datetime.now().isoformat(),
        "universe": "Nifty50 (demo subset)",
    }
