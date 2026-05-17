from datetime import datetime, date, time, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
import pytz
import re
import math
import logging

logger = logging.getLogger(__name__)

# Indian Standard Time
IST = pytz.timezone("Asia/Kolkata")

# NSE market hours
MARKET_OPEN_TIME = time(9, 15)
MARKET_CLOSE_TIME = time(15, 30)

# NSE/BSE holidays 2024-2025 (partial list)
NSE_HOLIDAYS_2025 = [
    date(2025, 1, 26),  # Republic Day
    date(2025, 3, 14),  # Holi
    date(2025, 4, 14),  # Dr. Ambedkar Jayanti
    date(2025, 4, 18),  # Good Friday
    date(2025, 5, 1),   # Maharashtra Day
    date(2025, 8, 15),  # Independence Day
    date(2025, 10, 2),  # Gandhi Jayanti
    date(2025, 10, 24), # Dussehra
    date(2025, 11, 5),  # Diwali Laxmi Puja
    date(2025, 12, 25), # Christmas
]


def get_ist_now() -> datetime:
    """Get current datetime in IST."""
    return datetime.now(IST)


def is_market_open() -> bool:
    """Check if NSE market is currently open."""
    now = get_ist_now()
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    if now.date() in NSE_HOLIDAYS_2025:
        return False
    current_time = now.time()
    return MARKET_OPEN_TIME <= current_time <= MARKET_CLOSE_TIME


def get_market_status() -> Dict[str, Any]:
    """Return market status with next open/close time."""
    now = get_ist_now()
    open_dt = now.replace(hour=9, minute=15, second=0, microsecond=0)
    close_dt = now.replace(hour=15, minute=30, second=0, microsecond=0)

    is_open = is_market_open()
    return {
        "is_open": is_open,
        "current_time_ist": now.isoformat(),
        "market_open": open_dt.isoformat(),
        "market_close": close_dt.isoformat(),
        "next_open": open_dt.isoformat() if not is_open else None,
    }


def format_indian_currency(amount: float) -> str:
    """Format a number in Indian currency style (e.g., 1,23,456.78)."""
    if math.isnan(amount) or math.isinf(amount):
        return "₹0.00"
    is_negative = amount < 0
    amount = abs(amount)
    int_part = int(amount)
    dec_part = f"{amount - int_part:.2f}"[1:]

    s = str(int_part)
    if len(s) <= 3:
        result = s + dec_part
    else:
        last_three = s[-3:]
        remaining = s[:-3]
        parts = []
        while len(remaining) > 2:
            parts.append(remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            parts.append(remaining)
        result = ",".join(reversed(parts)) + "," + last_three + dec_part

    return f"{'−' if is_negative else ''}₹{result}"


def calculate_lot_size(symbol: str) -> int:
    """Return standard F&O lot size for common Indian stocks/indices."""
    lot_sizes = {
        "NIFTY": 25,
        "BANKNIFTY": 15,
        "FINNIFTY": 40,
        "MIDCPNIFTY": 75,
        "SENSEX": 10,
        "RELIANCE": 250,
        "TCS": 150,
        "INFY": 300,
        "HDFC": 550,
        "HDFCBANK": 550,
        "ICICIBANK": 700,
        "SBIN": 1500,
        "TATAMOTORS": 1425,
        "BAJFINANCE": 125,
        "WIPRO": 1500,
        "AXISBANK": 1200,
        "KOTAKBANK": 400,
        "LT": 175,
        "MARUTI": 100,
        "SUNPHARMA": 700,
    }
    return lot_sizes.get(symbol.upper(), 500)


def normalize_symbol(symbol: str, exchange: str = "NSE") -> str:
    """
    Normalize a stock symbol for yfinance or broker API use.
    NSE stocks get .NS suffix, BSE get .BO suffix.
    """
    symbol = symbol.upper().strip()
    if exchange.upper() == "NSE":
        if not symbol.endswith(".NS"):
            return f"{symbol}.NS"
    elif exchange.upper() == "BSE":
        if not symbol.endswith(".BO"):
            return f"{symbol}.BO"
    return symbol


def strip_exchange_suffix(symbol: str) -> str:
    """Remove .NS or .BO suffix from symbol."""
    return symbol.replace(".NS", "").replace(".BO", "").upper()


def timeframe_to_minutes(timeframe: str) -> int:
    """Convert timeframe string to minutes."""
    mappings = {
        "1m": 1, "2m": 2, "3m": 3, "5m": 5, "10m": 10,
        "15m": 15, "30m": 30, "45m": 45, "1h": 60, "2h": 120,
        "4h": 240, "1d": 1440, "1w": 10080, "1M": 43200,
    }
    return mappings.get(timeframe, 15)


def timeframe_to_yfinance_interval(timeframe: str) -> str:
    """Convert our timeframe to yfinance interval string."""
    mappings = {
        "1m": "1m", "2m": "2m", "3m": "5m", "5m": "5m",
        "10m": "15m", "15m": "15m", "30m": "30m",
        "45m": "60m", "1h": "60m", "2h": "60m",
        "4h": "1d", "1d": "1d", "1w": "1wk", "1M": "1mo",
    }
    return mappings.get(timeframe, "15m")


def timeframe_to_yfinance_period(timeframe: str, bars: int = 200) -> str:
    """Calculate yfinance period needed to get `bars` candles."""
    minutes = timeframe_to_minutes(timeframe)
    total_minutes = minutes * bars
    days = math.ceil(total_minutes / (6.25 * 60))  # 6h15m per trading day
    if days <= 7:
        return "7d"
    elif days <= 30:
        return "1mo"
    elif days <= 90:
        return "3mo"
    elif days <= 180:
        return "6mo"
    elif days <= 365:
        return "1y"
    elif days <= 730:
        return "2y"
    else:
        return "5y"


def calculate_risk_reward(
    entry: float,
    stop_loss: float,
    target: float,
    trade_type: str = "BUY",
) -> Dict[str, float]:
    """Calculate risk/reward ratio for a trade."""
    if trade_type.upper() == "BUY":
        risk = entry - stop_loss
        reward = target - entry
    else:
        risk = stop_loss - entry
        reward = entry - target

    if risk <= 0:
        return {"risk": 0, "reward": reward, "ratio": 0, "valid": False}

    ratio = reward / risk if risk > 0 else 0
    return {
        "risk": round(risk, 2),
        "reward": round(reward, 2),
        "ratio": round(ratio, 2),
        "risk_percent": round((risk / entry) * 100, 2),
        "reward_percent": round((reward / entry) * 100, 2),
        "valid": ratio >= 1.5,
    }


def calculate_position_size(
    capital: float,
    risk_percent: float,
    entry_price: float,
    stop_loss: float,
) -> Dict[str, Any]:
    """Calculate position size based on risk per trade."""
    risk_amount = capital * (risk_percent / 100)
    per_share_risk = abs(entry_price - stop_loss)
    if per_share_risk == 0:
        return {"quantity": 0, "risk_amount": 0, "invested": 0}
    quantity = int(risk_amount / per_share_risk)
    invested = quantity * entry_price
    return {
        "quantity": quantity,
        "risk_amount": round(risk_amount, 2),
        "invested": round(invested, 2),
        "per_share_risk": round(per_share_risk, 2),
    }


def validate_symbol(symbol: str) -> bool:
    """Basic validation for stock symbol format."""
    pattern = r'^[A-Z0-9&\-\.]{1,30}$'
    return bool(re.match(pattern, symbol.upper()))


def get_expiry_thursdays(months_ahead: int = 3) -> List[date]:
    """Get list of upcoming monthly expiry dates (last Thursday of month) for NSE F&O."""
    expiries = []
    today = date.today()
    for m in range(months_ahead + 1):
        month = (today.month + m - 1) % 12 + 1
        year = today.year + (today.month + m - 1) // 12
        # Find last Thursday of the month
        last_day = date(year, month, 28)
        # Move to end of month
        while True:
            try:
                next_day = last_day + timedelta(days=1)
                if next_day.month != month:
                    break
                last_day = next_day
            except ValueError:
                break
        # Find last Thursday
        day = last_day
        while day.weekday() != 3:  # 3 = Thursday
            day -= timedelta(days=1)
        if day >= today:
            expiries.append(day)
    return expiries


def paginate(query_result: list, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    """Paginate a list of results."""
    total = len(query_result)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if page_size > 0 else 0,
        "items": query_result[start:end],
    }
