import pandas as pd
import numpy as np
from typing import Optional, Dict, List, Any, Tuple
import logging

logger = logging.getLogger(__name__)


def calculate_sma(data: pd.Series, period: int) -> pd.Series:
    """Simple Moving Average."""
    return data.rolling(window=period).mean()


def calculate_ema(data: pd.Series, period: int) -> pd.Series:
    """Exponential Moving Average."""
    return data.ewm(span=period, adjust=False).mean()


def calculate_rsi(data: pd.Series, period: int = 14) -> pd.Series:
    """
    Relative Strength Index using Wilder's smoothing method.
    Returns values between 0-100.
    """
    delta = data.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.fillna(50)


def calculate_macd(
    data: pd.Series,
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> Dict[str, pd.Series]:
    """
    MACD (Moving Average Convergence Divergence).
    Returns dict with 'macd', 'signal', 'histogram'.
    """
    ema_fast = calculate_ema(data, fast_period)
    ema_slow = calculate_ema(data, slow_period)
    macd_line = ema_fast - ema_slow
    signal_line = calculate_ema(macd_line, signal_period)
    histogram = macd_line - signal_line
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram,
    }


def calculate_bollinger_bands(
    data: pd.Series, period: int = 20, std_dev: float = 2.0
) -> Dict[str, pd.Series]:
    """
    Bollinger Bands.
    Returns dict with 'upper', 'middle', 'lower', 'bandwidth', 'percent_b'.
    """
    middle = calculate_sma(data, period)
    rolling_std = data.rolling(window=period).std()
    upper = middle + (rolling_std * std_dev)
    lower = middle - (rolling_std * std_dev)
    bandwidth = (upper - lower) / middle * 100
    percent_b = (data - lower) / (upper - lower)
    return {
        "upper": upper,
        "middle": middle,
        "lower": lower,
        "bandwidth": bandwidth,
        "percent_b": percent_b,
    }


def calculate_atr(
    df: pd.DataFrame, period: int = 14
) -> pd.Series:
    """
    Average True Range.
    Requires DataFrame with 'high', 'low', 'close' columns.
    """
    high = df["high"]
    low = df["low"]
    close = df["close"]
    prev_close = close.shift(1)

    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)

    atr = tr.ewm(com=period - 1, min_periods=period).mean()
    return atr


def calculate_vwap(df: pd.DataFrame) -> pd.Series:
    """
    Volume Weighted Average Price.
    Requires DataFrame with 'high', 'low', 'close', 'volume' columns.
    Resets at start of each trading session (by date).
    """
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    tp_volume = typical_price * df["volume"]

    # Group by date to reset VWAP each day
    if hasattr(df.index, "date"):
        dates = pd.Series(df.index.date, index=df.index)
        cumulative_tp_vol = tp_volume.groupby(dates).cumsum()
        cumulative_vol = df["volume"].groupby(dates).cumsum()
    else:
        cumulative_tp_vol = tp_volume.cumsum()
        cumulative_vol = df["volume"].cumsum()

    vwap = cumulative_tp_vol / cumulative_vol.replace(0, np.nan)
    return vwap


def calculate_supertrend(
    df: pd.DataFrame, period: int = 7, multiplier: float = 3.0
) -> Dict[str, pd.Series]:
    """
    Supertrend indicator.
    Returns dict with 'supertrend', 'direction' (1=bullish, -1=bearish), 'upper', 'lower'.
    """
    atr = calculate_atr(df, period)
    hl2 = (df["high"] + df["low"]) / 2

    upper_basic = hl2 + (multiplier * atr)
    lower_basic = hl2 - (multiplier * atr)

    upper_band = upper_basic.copy()
    lower_band = lower_basic.copy()
    supertrend = pd.Series(index=df.index, dtype=float)
    direction = pd.Series(index=df.index, dtype=int)

    close = df["close"]

    for i in range(1, len(df)):
        # Upper band
        if upper_basic.iloc[i] < upper_band.iloc[i - 1] or close.iloc[i - 1] > upper_band.iloc[i - 1]:
            upper_band.iloc[i] = upper_basic.iloc[i]
        else:
            upper_band.iloc[i] = upper_band.iloc[i - 1]

        # Lower band
        if lower_basic.iloc[i] > lower_band.iloc[i - 1] or close.iloc[i - 1] < lower_band.iloc[i - 1]:
            lower_band.iloc[i] = lower_basic.iloc[i]
        else:
            lower_band.iloc[i] = lower_band.iloc[i - 1]

        # Supertrend direction
        prev_st = supertrend.iloc[i - 1] if i > 1 else upper_band.iloc[i]
        if pd.isna(prev_st) or prev_st == upper_band.iloc[i - 1]:
            # Was bearish
            if close.iloc[i] <= upper_band.iloc[i]:
                supertrend.iloc[i] = upper_band.iloc[i]
                direction.iloc[i] = -1
            else:
                supertrend.iloc[i] = lower_band.iloc[i]
                direction.iloc[i] = 1
        else:
            # Was bullish
            if close.iloc[i] >= lower_band.iloc[i]:
                supertrend.iloc[i] = lower_band.iloc[i]
                direction.iloc[i] = 1
            else:
                supertrend.iloc[i] = upper_band.iloc[i]
                direction.iloc[i] = -1

    supertrend.iloc[0] = upper_band.iloc[0]
    direction.iloc[0] = -1

    return {
        "supertrend": supertrend,
        "direction": direction,
        "upper": upper_band,
        "lower": lower_band,
    }


def calculate_stochastic(
    df: pd.DataFrame, k_period: int = 14, d_period: int = 3, smooth: int = 3
) -> Dict[str, pd.Series]:
    """Stochastic Oscillator (%K and %D)."""
    lowest_low = df["low"].rolling(window=k_period).min()
    highest_high = df["high"].rolling(window=k_period).max()

    k_raw = 100 * (df["close"] - lowest_low) / (highest_high - lowest_low).replace(0, np.nan)
    k = k_raw.rolling(window=smooth).mean()
    d = k.rolling(window=d_period).mean()

    return {"k": k, "d": d}


def calculate_adx(df: pd.DataFrame, period: int = 14) -> Dict[str, pd.Series]:
    """
    Average Directional Index with +DI and -DI.
    Requires 'high', 'low', 'close'.
    """
    high = df["high"]
    low = df["low"]
    close = df["close"]

    plus_dm = high.diff()
    minus_dm = -low.diff()

    plus_dm[plus_dm < 0] = 0
    minus_dm[minus_dm < 0] = 0

    mask = plus_dm < minus_dm
    plus_dm[mask] = 0
    mask2 = minus_dm <= plus_dm
    minus_dm[mask2] = 0

    atr = calculate_atr(df, period)

    plus_di = 100 * calculate_ema(plus_dm, period) / atr
    minus_di = 100 * calculate_ema(minus_dm, period) / atr

    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx = calculate_ema(dx, period)

    return {"adx": adx, "plus_di": plus_di, "minus_di": minus_di}


def calculate_obv(df: pd.DataFrame) -> pd.Series:
    """On-Balance Volume."""
    close = df["close"]
    volume = df["volume"]
    direction = np.sign(close.diff()).fillna(0)
    obv = (direction * volume).cumsum()
    return obv


def calculate_ichimoku(df: pd.DataFrame) -> Dict[str, pd.Series]:
    """
    Ichimoku Cloud indicator.
    Returns tenkan_sen, kijun_sen, senkou_span_a, senkou_span_b, chikou_span.
    """
    high = df["high"]
    low = df["low"]
    close = df["close"]

    # Tenkan-sen (Conversion Line) - 9-period
    nine_high = high.rolling(9).max()
    nine_low = low.rolling(9).min()
    tenkan_sen = (nine_high + nine_low) / 2

    # Kijun-sen (Base Line) - 26-period
    twenty_six_high = high.rolling(26).max()
    twenty_six_low = low.rolling(26).min()
    kijun_sen = (twenty_six_high + twenty_six_low) / 2

    # Senkou Span A (Leading Span A) - shifted forward 26
    senkou_span_a = ((tenkan_sen + kijun_sen) / 2).shift(26)

    # Senkou Span B (Leading Span B) - 52-period shifted forward 26
    fifty_two_high = high.rolling(52).max()
    fifty_two_low = low.rolling(52).min()
    senkou_span_b = ((fifty_two_high + fifty_two_low) / 2).shift(26)

    # Chikou Span (Lagging Span) - shifted back 26
    chikou_span = close.shift(-26)

    return {
        "tenkan_sen": tenkan_sen,
        "kijun_sen": kijun_sen,
        "senkou_span_a": senkou_span_a,
        "senkou_span_b": senkou_span_b,
        "chikou_span": chikou_span,
    }


def detect_patterns(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Detect common candlestick and chart patterns.
    Returns a list of detected pattern dicts with name, index, type, strength.
    """
    patterns = []
    close = df["close"]
    high = df["high"]
    low = df["low"]
    open_ = df["open"]

    n = len(df)
    if n < 5:
        return patterns

    # --- Candlestick patterns ---
    for i in range(2, n):
        body = abs(close.iloc[i] - open_.iloc[i])
        full_range = high.iloc[i] - low.iloc[i]
        if full_range == 0:
            continue

        body_pct = body / full_range

        # Doji
        if body_pct < 0.05:
            patterns.append({
                "name": "Doji",
                "index": i,
                "timestamp": df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else str(df.index[i]),
                "type": "neutral",
                "strength": "weak",
            })

        # Hammer (bullish reversal)
        lower_shadow = min(open_.iloc[i], close.iloc[i]) - low.iloc[i]
        upper_shadow = high.iloc[i] - max(open_.iloc[i], close.iloc[i])
        if (
            lower_shadow > 2 * body
            and upper_shadow < 0.1 * full_range
            and close.iloc[i] > close.iloc[i - 1]  # In downtrend context
        ):
            patterns.append({
                "name": "Hammer",
                "index": i,
                "timestamp": df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else str(df.index[i]),
                "type": "bullish",
                "strength": "moderate",
            })

        # Shooting Star (bearish reversal)
        if (
            upper_shadow > 2 * body
            and lower_shadow < 0.1 * full_range
            and close.iloc[i] < close.iloc[i - 1]
        ):
            patterns.append({
                "name": "Shooting Star",
                "index": i,
                "timestamp": df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else str(df.index[i]),
                "type": "bearish",
                "strength": "moderate",
            })

        # Engulfing patterns (need i >= 1)
        if i >= 1:
            prev_body = abs(close.iloc[i - 1] - open_.iloc[i - 1])
            curr_body = abs(close.iloc[i] - open_.iloc[i])

            # Bullish Engulfing
            if (
                close.iloc[i - 1] < open_.iloc[i - 1]  # Previous candle bearish
                and close.iloc[i] > open_.iloc[i]        # Current candle bullish
                and open_.iloc[i] <= close.iloc[i - 1]
                and close.iloc[i] >= open_.iloc[i - 1]
                and curr_body > prev_body
            ):
                patterns.append({
                    "name": "Bullish Engulfing",
                    "index": i,
                    "timestamp": df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else str(df.index[i]),
                    "type": "bullish",
                    "strength": "strong",
                })

            # Bearish Engulfing
            if (
                close.iloc[i - 1] > open_.iloc[i - 1]
                and close.iloc[i] < open_.iloc[i]
                and open_.iloc[i] >= close.iloc[i - 1]
                and close.iloc[i] <= open_.iloc[i - 1]
                and curr_body > prev_body
            ):
                patterns.append({
                    "name": "Bearish Engulfing",
                    "index": i,
                    "timestamp": df.index[i].isoformat() if hasattr(df.index[i], "isoformat") else str(df.index[i]),
                    "type": "bearish",
                    "strength": "strong",
                })

    # --- Chart patterns (need more bars) ---
    if n >= 20:
        # Double Top detection (simplified)
        window = min(50, n)
        recent_high = high.iloc[-window:]
        peak_indices = []
        for i in range(1, len(recent_high) - 1):
            if (
                recent_high.iloc[i] > recent_high.iloc[i - 1]
                and recent_high.iloc[i] > recent_high.iloc[i + 1]
                and recent_high.iloc[i] >= recent_high.max() * 0.98
            ):
                peak_indices.append(i)

        if len(peak_indices) >= 2:
            p1, p2 = peak_indices[-2], peak_indices[-1]
            if abs(recent_high.iloc[p1] - recent_high.iloc[p2]) / recent_high.iloc[p1] < 0.02:
                patterns.append({
                    "name": "Double Top",
                    "index": n - window + peak_indices[-1],
                    "timestamp": df.index[-1].isoformat() if hasattr(df.index[-1], "isoformat") else str(df.index[-1]),
                    "type": "bearish",
                    "strength": "strong",
                })

        # Double Bottom detection (simplified)
        recent_low = low.iloc[-window:]
        trough_indices = []
        for i in range(1, len(recent_low) - 1):
            if (
                recent_low.iloc[i] < recent_low.iloc[i - 1]
                and recent_low.iloc[i] < recent_low.iloc[i + 1]
                and recent_low.iloc[i] <= recent_low.min() * 1.02
            ):
                trough_indices.append(i)

        if len(trough_indices) >= 2:
            t1, t2 = trough_indices[-2], trough_indices[-1]
            if abs(recent_low.iloc[t1] - recent_low.iloc[t2]) / recent_low.iloc[t1] < 0.02:
                patterns.append({
                    "name": "Double Bottom",
                    "index": n - window + trough_indices[-1],
                    "timestamp": df.index[-1].isoformat() if hasattr(df.index[-1], "isoformat") else str(df.index[-1]),
                    "type": "bullish",
                    "strength": "strong",
                })

    return patterns


def calculate_volume_profile(data: pd.DataFrame, bins: int = 20) -> pd.DataFrame:
    """
    Price-Volume Profile (histogram).

    Returns a DataFrame with columns: price_level, volume, pct_of_total, is_poc.
    The price_level is the mid-point of each price bin.
    The Point of Control (POC) is the bin with highest volume.
    """
    df = data.copy()
    df.columns = [c.lower() for c in df.columns]

    price_min = df["low"].min()
    price_max = df["high"].max()

    price_bins = np.linspace(price_min, price_max, bins + 1)
    bin_mid = (price_bins[:-1] + price_bins[1:]) / 2
    volumes = np.zeros(bins)

    for _, row in df.iterrows():
        for b_idx in range(bins):
            lo = price_bins[b_idx]
            hi = price_bins[b_idx + 1]
            overlap = max(0.0, min(row["high"], hi) - max(row["low"], lo))
            candle_range = row["high"] - row["low"]
            if candle_range > 0:
                volumes[b_idx] += row["volume"] * (overlap / candle_range)
            elif lo <= row["close"] <= hi:
                volumes[b_idx] += row["volume"]

    total_vol = volumes.sum()
    profile = pd.DataFrame(
        {
            "price_level": bin_mid,
            "volume": volumes,
            "pct_of_total": (volumes / total_vol * 100) if total_vol > 0 else volumes,
        }
    )
    poc_idx = int(profile["volume"].idxmax())
    profile["is_poc"] = False
    profile.loc[poc_idx, "is_poc"] = True
    return profile


def find_support_resistance(data: pd.DataFrame, window: int = 20) -> dict:
    """
    Find key support and resistance levels using rolling pivots.

    Also returns classic floor-trader pivot points based on the last candle.

    Returns
    -------
    dict with keys:
        support    : list[float] – clustered support levels
        resistance : list[float] – clustered resistance levels
        pivot      : float       – (H+L+C)/3 of last candle
        r1, r2     : float       – resistance extensions
        s1, s2     : float       – support extensions
    """
    df = data.copy()
    df.columns = [c.lower() for c in df.columns]

    # ── Classic Pivot (last candle) ────────────────────────────────────────
    last = df.iloc[-1]
    pivot = (last["high"] + last["low"] + last["close"]) / 3
    r1 = 2 * pivot - last["low"]
    r2 = pivot + (last["high"] - last["low"])
    s1 = 2 * pivot - last["high"]
    s2 = pivot - (last["high"] - last["low"])

    def cluster_levels(levels: List[float], tol_pct: float = 0.003) -> List[float]:
        if not levels:
            return []
        levels = sorted(levels)
        clusters: List[List[float]] = [[levels[0]]]
        for lvl in levels[1:]:
            ref = clusters[-1][-1]
            if ref != 0 and abs(lvl - ref) / ref < tol_pct:
                clusters[-1].append(lvl)
            else:
                clusters.append([lvl])
        return [round(sum(c) / len(c), 2) for c in clusters]

    resistance_raw: List[float] = []
    support_raw: List[float] = []
    n = len(df)

    for i in range(window, n - window):
        seg_high = df["high"].iloc[i - window: i + window + 1]
        seg_low = df["low"].iloc[i - window: i + window + 1]
        if df["high"].iloc[i] == seg_high.max():
            resistance_raw.append(float(df["high"].iloc[i]))
        if df["low"].iloc[i] == seg_low.min():
            support_raw.append(float(df["low"].iloc[i]))

    return {
        "support": cluster_levels(support_raw),
        "resistance": cluster_levels(resistance_raw),
        "pivot": round(float(pivot), 2),
        "r1": round(float(r1), 2),
        "r2": round(float(r2), 2),
        "s1": round(float(s1), 2),
        "s2": round(float(s2), 2),
    }


def calculate_all_indicators(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculate all common technical indicators for a given OHLCV DataFrame.
    Returns a dict of indicator results as lists (JSON-serializable).
    """
    result: Dict[str, Any] = {}

    try:
        close = df["close"]

        # Moving averages
        result["sma_20"] = calculate_sma(close, 20).round(2).tolist()
        result["sma_50"] = calculate_sma(close, 50).round(2).tolist()
        result["sma_200"] = calculate_sma(close, 200).round(2).tolist()
        result["ema_9"] = calculate_ema(close, 9).round(2).tolist()
        result["ema_21"] = calculate_ema(close, 21).round(2).tolist()

        # RSI
        result["rsi"] = calculate_rsi(close, 14).round(2).tolist()

        # MACD
        macd = calculate_macd(close)
        result["macd"] = {
            "macd": macd["macd"].round(2).tolist(),
            "signal": macd["signal"].round(2).tolist(),
            "histogram": macd["histogram"].round(2).tolist(),
        }

        # Bollinger Bands
        bb = calculate_bollinger_bands(close)
        result["bollinger_bands"] = {
            "upper": bb["upper"].round(2).tolist(),
            "middle": bb["middle"].round(2).tolist(),
            "lower": bb["lower"].round(2).tolist(),
            "bandwidth": bb["bandwidth"].round(2).tolist(),
        }

        # ATR
        result["atr"] = calculate_atr(df, 14).round(2).tolist()

        # VWAP
        result["vwap"] = calculate_vwap(df).round(2).tolist()

        # Supertrend
        st = calculate_supertrend(df)
        result["supertrend"] = {
            "value": st["supertrend"].round(2).tolist(),
            "direction": st["direction"].tolist(),
        }

        # Stochastic
        stoch = calculate_stochastic(df)
        result["stochastic"] = {
            "k": stoch["k"].round(2).tolist(),
            "d": stoch["d"].round(2).tolist(),
        }

        # ADX
        adx = calculate_adx(df)
        result["adx"] = {
            "adx": adx["adx"].round(2).tolist(),
            "plus_di": adx["plus_di"].round(2).tolist(),
            "minus_di": adx["minus_di"].round(2).tolist(),
        }

        # OBV
        result["obv"] = calculate_obv(df).tolist()

        # Patterns
        result["patterns"] = detect_patterns(df)

    except Exception as e:
        logger.error(f"Error calculating indicators: {e}", exc_info=True)

    return result
