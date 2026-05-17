"""
AI Trading Assistant
====================
Supports both Anthropic (Claude) and OpenAI (GPT) backends with graceful fallback.
Designed for Indian stock market context: NSE/BSE, F&O, Nifty50, BankNifty.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import anthropic
import openai

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Default model identifiers
# ─────────────────────────────────────────────────────────────────────────────
_ANTHROPIC_MODEL = "claude-sonnet-4-6"
_OPENAI_MODEL = "gpt-4o"


class AIAssistant:
    """
    AI-powered trading assistant with dual-provider support.

    Parameters
    ----------
    api_key  : str  – API key for the chosen provider
    provider : str  – "anthropic" (default) | "openai"
    """

    def __init__(self, api_key: str, provider: str = "anthropic"):
        self.provider = provider.lower()
        self._client: Optional[anthropic.Anthropic | openai.AsyncOpenAI] = None

        if self.provider == "anthropic":
            self._client = anthropic.AsyncAnthropic(api_key=api_key)
        elif self.provider == "openai":
            self._client = openai.AsyncOpenAI(api_key=api_key)
        else:
            raise ValueError(f"Unsupported AI provider: {provider!r}. Use 'anthropic' or 'openai'.")

        logger.info(f"AIAssistant initialised with provider={self.provider!r}")

    # ── System Prompt ──────────────────────────────────────────────────────

    def _build_system_prompt(self) -> str:
        return (
            "You are an expert Indian stock market analyst and trader with 15+ years of experience.\n"
            "You specialise in NSE/BSE markets, F&O trading, technical analysis, and risk management.\n"
            "Always provide actionable insights with specific entry, SL, and target levels.\n"
            "Consider Indian market context: Nifty50, BankNifty, FII/DII activity, global cues.\n"
            "Format responses clearly with bullet points and specific numbers.\n"
            "Use INR (₹) for all prices. Lot sizes: Nifty=50, BankNifty=15, FinNifty=40.\n"
            "Be concise, factual, and risk-aware. Always mention position sizing."
        )

    # ── Core LLM Call ──────────────────────────────────────────────────────

    async def _call_llm(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.3,
    ) -> str:
        """Send messages to the configured provider and return text response."""
        system_prompt = self._build_system_prompt()
        try:
            if self.provider == "anthropic":
                response = await self._client.messages.create(
                    model=_ANTHROPIC_MODEL,
                    max_tokens=max_tokens,
                    system=system_prompt,
                    messages=messages,
                )
                return response.content[0].text

            else:  # openai
                full_messages = [{"role": "system", "content": system_prompt}] + messages
                response = await self._client.chat.completions.create(
                    model=_OPENAI_MODEL,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=full_messages,
                )
                return response.choices[0].message.content

        except (anthropic.APIError, openai.APIError) as exc:
            logger.error(f"Primary provider ({self.provider}) failed: {exc}")
            raise

    # ── Public Methods ─────────────────────────────────────────────────────

    async def chat(self, message: str, context: Optional[dict] = None) -> str:
        """
        General-purpose chat with optional trading context.

        Parameters
        ----------
        message : str  – user query
        context : dict – optional dict with keys like 'symbol', 'portfolio', 'watchlist'
        """
        user_content = message
        if context:
            user_content = f"Context: {json.dumps(context, indent=2)}\n\nUser: {message}"

        messages = [{"role": "user", "content": user_content}]
        return await self._call_llm(messages, max_tokens=1024)

    async def analyze_symbol(
        self,
        symbol: str,
        candles: list[dict],
        indicators: dict,
    ) -> str:
        """
        Full technical analysis for a symbol.

        Parameters
        ----------
        symbol     : str       – e.g. "RELIANCE", "NIFTY50"
        candles    : list[dict] – recent OHLCV candles (latest last)
        indicators : dict       – pre-calculated indicator values
        """
        recent = candles[-10:] if len(candles) > 10 else candles
        prompt = (
            f"Perform a detailed technical analysis for **{symbol}**.\n\n"
            f"Recent candles (last {len(recent)}):\n{json.dumps(recent, indent=2)}\n\n"
            f"Indicator values:\n{json.dumps(indicators, indent=2)}\n\n"
            "Provide:\n"
            "1. Current trend (bullish/bearish/sideways) with reasoning\n"
            "2. Key support and resistance levels\n"
            "3. Signal from each indicator (RSI, MACD, EMA, Supertrend)\n"
            "4. Short-term outlook (next 1-3 sessions)\n"
            "5. Risk factors to watch"
        )
        messages = [{"role": "user", "content": prompt}]
        return await self._call_llm(messages, max_tokens=1500)

    async def generate_trade_idea(self, market_context: dict) -> dict:
        """
        Generate a structured trade idea with entry, SL, target, and rationale.

        Parameters
        ----------
        market_context : dict – keys: symbol, ltp, sector, trend, indicators

        Returns
        -------
        dict with keys: symbol, action, entry, sl, target, rationale, r_r_ratio, confidence
        """
        prompt = (
            "Based on the following market context, generate ONE high-probability trade idea.\n\n"
            f"Context:\n{json.dumps(market_context, indent=2)}\n\n"
            "Return your response as a valid JSON object with these fields:\n"
            "{\n"
            '  "symbol": "...",\n'
            '  "action": "BUY" | "SELL",\n'
            '  "entry": <price>,\n'
            '  "stop_loss": <price>,\n'
            '  "target_1": <price>,\n'
            '  "target_2": <price>,\n'
            '  "rationale": "...",\n'
            '  "r_r_ratio": <number>,\n'
            '  "confidence": "LOW" | "MEDIUM" | "HIGH",\n'
            '  "timeframe": "Intraday" | "Swing" | "Positional"\n'
            "}"
        )
        messages = [{"role": "user", "content": prompt}]
        raw = await self._call_llm(messages, max_tokens=512)

        # Extract JSON from response
        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(raw[start:end])
        except json.JSONDecodeError as exc:
            logger.warning(f"JSON parse failed for trade idea: {exc}")

        # Fallback: return raw text in structured form
        return {"raw_response": raw}

    async def explain_pattern(self, pattern_name: str, candle_data: list[dict]) -> str:
        """
        Explain a detected chart pattern in plain language.

        Parameters
        ----------
        pattern_name : str       – e.g. "double_top", "head_and_shoulders"
        candle_data  : list[dict] – OHLCV data around the pattern
        """
        prompt = (
            f"Explain the **{pattern_name.replace('_', ' ').title()}** chart pattern.\n\n"
            f"Relevant candle data:\n{json.dumps(candle_data[:20], indent=2)}\n\n"
            "Include:\n"
            "1. What the pattern means\n"
            "2. How to trade it (entry trigger, SL, target)\n"
            "3. Confirmation signals to look for\n"
            "4. Failure scenarios"
        )
        messages = [{"role": "user", "content": prompt}]
        return await self._call_llm(messages, max_tokens=800)

    async def analyze_risk(self, trade_params: dict) -> dict:
        """
        Risk analysis for a proposed trade.

        Parameters
        ----------
        trade_params : dict – keys: symbol, entry, sl, target, capital, quantity

        Returns
        -------
        dict with risk metrics and position sizing suggestion
        """
        entry = float(trade_params.get("entry", 0))
        sl = float(trade_params.get("sl", 0))
        target = float(trade_params.get("target", 0))
        capital = float(trade_params.get("capital", 100_000))
        quantity = int(trade_params.get("quantity", 1))

        risk_per_share = abs(entry - sl)
        reward_per_share = abs(target - entry)
        r_r = round(reward_per_share / risk_per_share, 2) if risk_per_share > 0 else 0
        total_risk = risk_per_share * quantity
        risk_pct = round((total_risk / capital) * 100, 2)

        # 1% capital rule: suggested quantity
        max_risk_capital = capital * 0.01
        suggested_qty = max(1, int(max_risk_capital / risk_per_share)) if risk_per_share > 0 else quantity

        prompt = (
            f"Analyse the risk for this trade:\n{json.dumps(trade_params, indent=2)}\n\n"
            f"Calculated metrics:\n"
            f"- Risk per share: ₹{risk_per_share:.2f}\n"
            f"- Reward per share: ₹{reward_per_share:.2f}\n"
            f"- R:R ratio: {r_r}\n"
            f"- Total risk: ₹{total_risk:.2f} ({risk_pct}% of capital)\n"
            f"- Suggested qty (1% rule): {suggested_qty}\n\n"
            "Provide a brief risk assessment (2-3 sentences) and any warnings."
        )
        messages = [{"role": "user", "content": prompt}]
        assessment = await self._call_llm(messages, max_tokens=300)

        return {
            "r_r_ratio": r_r,
            "risk_per_share": round(risk_per_share, 2),
            "reward_per_share": round(reward_per_share, 2),
            "total_risk_inr": round(total_risk, 2),
            "risk_pct_of_capital": risk_pct,
            "suggested_quantity": suggested_qty,
            "assessment": assessment,
        }

    async def analyze_options(self, option_chain: dict, context: dict) -> str:
        """
        Analyse option chain data and suggest strategies.

        Parameters
        ----------
        option_chain : dict – CE/PE data for multiple strikes (OI, IV, LTP)
        context      : dict – spot price, trend, days to expiry
        """
        prompt = (
            f"Analyse this option chain data for the Indian market:\n\n"
            f"Market Context:\n{json.dumps(context, indent=2)}\n\n"
            f"Option Chain (selected strikes):\n{json.dumps(option_chain, indent=2)}\n\n"
            "Provide:\n"
            "1. PCR (Put-Call Ratio) analysis and market sentiment\n"
            "2. Max pain level\n"
            "3. Key OI build-up levels (support/resistance)\n"
            "4. IV Skew analysis\n"
            "5. Recommended option strategy with specific strikes and premium"
        )
        messages = [{"role": "user", "content": prompt}]
        return await self._call_llm(messages, max_tokens=1200)

    async def sentiment_analysis(self, news_items: list[dict]) -> dict:
        """
        Analyse market/stock news sentiment.

        Parameters
        ----------
        news_items : list[dict] – each with 'headline', 'source', optionally 'body'

        Returns
        -------
        dict with overall_sentiment, score, key_themes, trading_implication
        """
        headlines_text = "\n".join(
            f"- [{item.get('source', 'Unknown')}] {item.get('headline', '')}"
            for item in news_items[:20]
        )
        prompt = (
            f"Analyse the sentiment of the following Indian stock market news headlines:\n\n"
            f"{headlines_text}\n\n"
            "Return a valid JSON object with:\n"
            "{\n"
            '  "overall_sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",\n'
            '  "score": <-1.0 to 1.0>,\n'
            '  "key_themes": ["theme1", "theme2"],\n'
            '  "affected_sectors": ["sector1"],\n'
            '  "trading_implication": "...",\n'
            '  "risk_events": ["..."],\n'
            '  "confidence": "LOW" | "MEDIUM" | "HIGH"\n'
            "}"
        )
        messages = [{"role": "user", "content": prompt}]
        raw = await self._call_llm(messages, max_tokens=512)

        try:
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(raw[start:end])
        except json.JSONDecodeError as exc:
            logger.warning(f"Sentiment JSON parse failed: {exc}")

        return {"raw_response": raw, "overall_sentiment": "NEUTRAL", "score": 0.0}

    async def suggest_watchlist(self, portfolio_context: dict) -> list[dict]:
        """
        Suggest stocks to add to watchlist based on current portfolio and market conditions.

        Parameters
        ----------
        portfolio_context : dict – existing holdings, capital, risk appetite, timeframe

        Returns
        -------
        list of dicts: [{symbol, rationale, sector, risk_level}]
        """
        prompt = (
            f"Based on this portfolio profile, suggest 5 NSE stocks for the watchlist:\n\n"
            f"{json.dumps(portfolio_context, indent=2)}\n\n"
            "Return a JSON array:\n"
            "[\n"
            "  {\n"
            '    "symbol": "SYMBOL.NS",\n'
            '    "company": "Full Name",\n'
            '    "sector": "...",\n'
            '    "rationale": "...",\n'
            '    "risk_level": "LOW" | "MEDIUM" | "HIGH",\n'
            '    "suggested_timeframe": "Intraday" | "Swing" | "Positional"\n'
            "  }\n"
            "]"
        )
        messages = [{"role": "user", "content": prompt}]
        raw = await self._call_llm(messages, max_tokens=800)

        try:
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start >= 0 and end > start:
                return json.loads(raw[start:end])
        except json.JSONDecodeError:
            pass

        return []
