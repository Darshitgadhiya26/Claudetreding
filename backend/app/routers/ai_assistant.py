from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from app.models.user import User
from app.utils.auth import get_current_user
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Assistant"])


def _get_assistant():
    """Get AI assistant with available API key."""
    from app.ai.assistant import AIAssistant

    if settings.ANTHROPIC_API_KEY:
        return AIAssistant(api_key=settings.ANTHROPIC_API_KEY, provider="anthropic")
    elif settings.OPENAI_API_KEY:
        return AIAssistant(api_key=settings.OPENAI_API_KEY, provider="openai")
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in environment.",
        )


# ── Schemas ─────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context: Optional[Dict[str, Any]] = None


class AnalyzeRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"
    timeframe: str = "15m"
    include_indicators: bool = True


class TradeIdeaRequest(BaseModel):
    symbol: Optional[str] = None
    market_context: Optional[Dict[str, Any]] = None
    risk_appetite: str = "MODERATE"  # CONSERVATIVE | MODERATE | AGGRESSIVE
    timeframe: str = "Intraday"


class RiskAnalysisRequest(BaseModel):
    symbol: str
    entry: float
    stop_loss: float
    target: float
    quantity: int = 1
    capital: float = 100000.0
    trade_type: str = "BUY"


class PatternExplainRequest(BaseModel):
    pattern_name: str
    symbol: str
    exchange: str = "NSE"
    timeframe: str = "15m"


class NewsItem(BaseModel):
    headline: str
    source: str = "Unknown"
    body: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    payload: ChatMessage,
    current_user: User = Depends(get_current_user),
):
    """
    Chat with AI trading assistant.
    Provides market analysis, strategy advice, and trading guidance.
    """
    assistant = _get_assistant()

    # Add user preferences to context
    context = payload.context or {}
    context["user_preferences"] = current_user.preferences or {}

    try:
        response = await assistant.chat(payload.message, context)
        return {
            "response": response,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}",
        )


@router.get("/analyze/{symbol}")
async def analyze_symbol(
    symbol: str,
    exchange: str = Query("NSE"),
    timeframe: str = Query("15m"),
    current_user: User = Depends(get_current_user),
):
    """
    Get AI-powered technical analysis for a symbol.
    Fetches live data and runs full indicator analysis before asking AI.
    """
    from app.services.market_data import market_data_service
    from app.indicators.technical import calculate_all_indicators
    import pandas as pd

    # Fetch market data
    df = await market_data_service.fetch_candles_as_dataframe(
        symbol, timeframe, exchange, limit=100
    )

    if df is None or df.empty:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch data for {symbol}",
        )

    # Calculate all indicators
    indicators = calculate_all_indicators(df)

    # Get summary of latest values
    summary_indicators = {
        "rsi": indicators.get("rsi", [None])[-1],
        "macd_histogram": (indicators.get("macd") or {}).get("histogram", [None])[-1],
        "ema_9": indicators.get("ema_9", [None])[-1],
        "ema_21": indicators.get("ema_21", [None])[-1],
        "sma_50": indicators.get("sma_50", [None])[-1],
        "vwap": indicators.get("vwap", [None])[-1],
        "supertrend_direction": (indicators.get("supertrend") or {}).get("direction", [None])[-1],
        "atr": indicators.get("atr", [None])[-1],
        "patterns": indicators.get("patterns", []),
    }

    # Get last 10 candles as context
    candles = df.tail(10).reset_index()
    candle_list = candles.to_dict("records")
    for c in candle_list:
        if hasattr(c.get("timestamp"), "isoformat"):
            c["timestamp"] = c["timestamp"].isoformat()

    assistant = _get_assistant()
    try:
        analysis = await assistant.analyze_symbol(
            symbol=symbol,
            candles=candle_list,
            indicators=summary_indicators,
        )
        return {
            "symbol": symbol.upper(),
            "exchange": exchange,
            "timeframe": timeframe,
            "analysis": analysis,
            "indicators": summary_indicators,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/generate-idea")
async def generate_trade_idea(
    payload: TradeIdeaRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Generate a specific trade idea with entry, SL, and target levels.
    Uses live market context when symbol is provided.
    """
    market_context = payload.market_context or {}

    if payload.symbol:
        from app.services.market_data import market_data_service
        quote = await market_data_service.fetch_quote(payload.symbol, "NSE")
        market_context.update({
            "symbol": payload.symbol.upper(),
            "ltp": quote.get("price"),
            "change_percent": quote.get("change_percent"),
            "volume": quote.get("volume"),
        })

    market_context["risk_appetite"] = payload.risk_appetite
    market_context["timeframe"] = payload.timeframe

    assistant = _get_assistant()
    try:
        idea = await assistant.generate_trade_idea(market_context)
        return {
            "trade_idea": idea,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Trade idea generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-risk")
async def analyze_risk(
    payload: RiskAnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze risk metrics for a proposed trade."""
    assistant = _get_assistant()
    try:
        analysis = await assistant.analyze_risk({
            "symbol": payload.symbol,
            "entry": payload.entry,
            "sl": payload.stop_loss,
            "target": payload.target,
            "quantity": payload.quantity,
            "capital": payload.capital,
            "trade_type": payload.trade_type,
        })
        return {
            "risk_analysis": analysis,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Risk analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain-pattern")
async def explain_pattern(
    payload: PatternExplainRequest,
    current_user: User = Depends(get_current_user),
):
    """Get AI explanation of a detected chart pattern with trade guidance."""
    from app.services.market_data import market_data_service

    candles = await market_data_service.fetch_candles(
        payload.symbol, payload.timeframe, payload.exchange, limit=30
    )

    assistant = _get_assistant()
    try:
        explanation = await assistant.explain_pattern(payload.pattern_name, candles)
        return {
            "pattern": payload.pattern_name,
            "symbol": payload.symbol,
            "explanation": explanation,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Pattern explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sentiment")
async def analyze_sentiment(
    news_items: List[NewsItem],
    current_user: User = Depends(get_current_user),
):
    """Analyze sentiment of news headlines."""
    if not news_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one news item is required",
        )

    assistant = _get_assistant()
    try:
        sentiment = await assistant.sentiment_analysis(
            [item.model_dump() for item in news_items]
        )
        return {
            "sentiment": sentiment,
            "items_analyzed": len(news_items),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watchlist-suggestions")
async def suggest_watchlist(
    risk_appetite: str = Query("MODERATE"),
    timeframe: str = Query("Swing"),
    current_user: User = Depends(get_current_user),
):
    """Get AI suggestions for stocks to add to watchlist."""
    portfolio_context = {
        "risk_appetite": risk_appetite,
        "timeframe": timeframe,
        "preferences": current_user.preferences or {},
    }

    assistant = _get_assistant()
    try:
        suggestions = await assistant.suggest_watchlist(portfolio_context)
        return {
            "suggestions": suggestions,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Watchlist suggestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
