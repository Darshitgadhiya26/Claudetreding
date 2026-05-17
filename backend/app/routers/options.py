from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime
import logging
import math

from app.models.user import User
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/options", tags=["Options"])


def _black_scholes_greeks(
    S: float,   # Spot price
    K: float,   # Strike price
    T: float,   # Time to expiry in years
    r: float,   # Risk-free rate
    sigma: float,  # Implied volatility (as decimal)
    option_type: str,  # "CE" or "PE"
) -> dict:
    """
    Calculate Black-Scholes option greeks.
    Returns delta, gamma, theta, vega, rho.
    """
    import math

    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0, "error": "Invalid inputs"}

    try:
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)

        def norm_cdf(x):
            return (1.0 + math.erf(x / math.sqrt(2))) / 2.0

        def norm_pdf(x):
            return math.exp(-0.5 * x ** 2) / math.sqrt(2 * math.pi)

        nd1 = norm_cdf(d1)
        nd2 = norm_cdf(d2)
        n_neg_d1 = norm_cdf(-d1)
        n_neg_d2 = norm_cdf(-d2)
        pdf_d1 = norm_pdf(d1)

        gamma = pdf_d1 / (S * sigma * math.sqrt(T))
        vega = S * pdf_d1 * math.sqrt(T) / 100  # Per 1% IV change

        if option_type.upper() == "CE":
            price = S * nd1 - K * math.exp(-r * T) * nd2
            delta = nd1
            theta = (
                -(S * pdf_d1 * sigma) / (2 * math.sqrt(T))
                - r * K * math.exp(-r * T) * nd2
            ) / 365
            rho = K * T * math.exp(-r * T) * nd2 / 100
        else:  # PE
            price = K * math.exp(-r * T) * n_neg_d2 - S * n_neg_d1
            delta = nd1 - 1
            theta = (
                -(S * pdf_d1 * sigma) / (2 * math.sqrt(T))
                + r * K * math.exp(-r * T) * n_neg_d2
            ) / 365
            rho = -K * T * math.exp(-r * T) * n_neg_d2 / 100

        return {
            "theoretical_price": round(price, 2),
            "delta": round(delta, 4),
            "gamma": round(gamma, 6),
            "theta": round(theta, 4),
            "vega": round(vega, 4),
            "rho": round(rho, 4),
            "d1": round(d1, 4),
            "d2": round(d2, 4),
        }

    except (ValueError, ZeroDivisionError, OverflowError) as e:
        logger.warning(f"Black-Scholes calculation error: {e}")
        return {"error": str(e)}


@router.get("/option-chain/{symbol}")
async def get_option_chain(
    symbol: str,
    expiry: Optional[str] = Query(None, description="Expiry date YYYY-MM-DD (uses nearest if not set)"),
    current_user: User = Depends(get_current_user),
):
    """
    Get full option chain for a symbol (NSE F&O stocks and indices).
    Returns calls and puts with OI, IV, LTP, greeks.
    """
    from app.services.market_data import market_data_service

    try:
        chain = await market_data_service.get_option_chain(symbol, expiry)

        if "error" in chain:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=chain["error"],
            )

        # Enrich with greeks
        spot = chain.get("spot_price", 0)
        expiry_date = chain.get("expiry")

        if expiry_date and spot > 0:
            try:
                exp_dt = datetime.strptime(expiry_date, "%Y-%m-%d")
                days_to_expiry = max((exp_dt - datetime.utcnow()).days, 1)
                T = days_to_expiry / 365.0
                r = 0.065  # 6.5% risk-free rate (India 10Y bond)

                for call in chain.get("calls", []):
                    iv = call.get("implied_volatility", 0) / 100
                    if iv > 0:
                        greeks = _black_scholes_greeks(
                            spot, call["strike"], T, r, iv, "CE"
                        )
                        call["greeks"] = greeks

                for put in chain.get("puts", []):
                    iv = put.get("implied_volatility", 0) / 100
                    if iv > 0:
                        greeks = _black_scholes_greeks(
                            spot, put["strike"], T, r, iv, "PE"
                        )
                        put["greeks"] = greeks

            except (ValueError, TypeError):
                pass  # Greeks not critical

        return chain

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Option chain fetch error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pcr/{symbol}")
async def get_pcr(
    symbol: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get Put-Call Ratio for a symbol.
    PCR > 1: Bullish (more puts written = support)
    PCR < 0.7: Bearish (more calls written = resistance)
    """
    from app.services.market_data import market_data_service

    try:
        pcr_data = await market_data_service.calculate_pcr(symbol)
        if "error" in pcr_data:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=pcr_data["error"],
            )
        return pcr_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/max-pain/{symbol}")
async def get_max_pain(
    symbol: str,
    current_user: User = Depends(get_current_user),
):
    """
    Calculate Max Pain for a symbol.
    Max Pain is the strike where maximum option premium expires worthless.
    Institutional players often push the price towards max pain near expiry.
    """
    from app.services.market_data import market_data_service

    try:
        max_pain_data = await market_data_service.calculate_max_pain(symbol)
        if "error" in max_pain_data:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=max_pain_data["error"],
            )
        return max_pain_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/greeks/{symbol}/{strike}")
async def get_option_greeks(
    symbol: str,
    strike: float,
    option_type: str = Query(..., description="CE or PE"),
    expiry: Optional[str] = Query(None, description="Expiry YYYY-MM-DD"),
    iv: Optional[float] = Query(None, description="Implied volatility % (fetched if not provided)"),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate option greeks for a specific strike using Black-Scholes.
    """
    if option_type.upper() not in ("CE", "PE"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="option_type must be CE or PE",
        )

    from app.services.market_data import market_data_service

    # Get spot price
    quote = await market_data_service.fetch_quote(symbol, "NSE")
    spot = quote.get("price", 0)
    if spot == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch spot price",
        )

    # Calculate time to expiry
    if expiry:
        try:
            exp_dt = datetime.strptime(expiry, "%Y-%m-%d")
            days_to_expiry = max((exp_dt - datetime.utcnow()).days, 1)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid expiry date format. Use YYYY-MM-DD",
            )
    else:
        from app.utils.helpers import get_expiry_thursdays
        expiries = get_expiry_thursdays(1)
        if expiries:
            exp_dt = expiries[0]
            days_to_expiry = max((exp_dt - datetime.utcnow().date()).days, 1)
        else:
            days_to_expiry = 7

    T = days_to_expiry / 365.0
    sigma = (iv or 20.0) / 100.0  # Use provided IV or default 20%
    r = 0.065

    greeks = _black_scholes_greeks(spot, strike, T, r, sigma, option_type.upper())

    return {
        "symbol": symbol.upper(),
        "strike": strike,
        "option_type": option_type.upper(),
        "spot_price": round(spot, 2),
        "days_to_expiry": days_to_expiry,
        "implied_volatility_pct": iv or 20.0,
        "greeks": greeks,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/iv-surface/{symbol}")
async def get_iv_surface(
    symbol: str,
    current_user: User = Depends(get_current_user),
):
    """
    Get Implied Volatility surface across strikes for a symbol.
    Returns IV at different moneyness levels (OTM, ATM, ITM).
    """
    from app.services.market_data import market_data_service

    chain_data = await market_data_service.get_option_chain(symbol)
    if "error" in chain_data:
        raise HTTPException(status_code=503, detail=chain_data["error"])

    spot = chain_data.get("spot_price", 0)
    calls = chain_data.get("calls", [])
    puts = chain_data.get("puts", [])

    iv_surface = []
    for call in calls:
        strike = call["strike"]
        moneyness = round((strike - spot) / spot * 100, 2) if spot > 0 else 0
        iv_surface.append({
            "strike": strike,
            "moneyness": moneyness,
            "call_iv": call.get("implied_volatility", 0),
            "put_iv": next(
                (p.get("implied_volatility", 0) for p in puts if p["strike"] == strike), 0
            ),
            "call_oi": call.get("open_interest", 0),
            "put_oi": next(
                (p.get("open_interest", 0) for p in puts if p["strike"] == strike), 0
            ),
        })

    iv_surface.sort(key=lambda x: x["strike"])

    return {
        "symbol": symbol.upper(),
        "spot_price": spot,
        "expiry": chain_data.get("expiry"),
        "iv_surface": iv_surface,
        "timestamp": datetime.utcnow().isoformat(),
    }
