import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.alert import Alert
from app.services.market_data import market_data_service
from app.indicators.technical import calculate_rsi, calculate_macd

logger = logging.getLogger(__name__)


class AlertService:
    """
    Handles alert condition evaluation and multi-channel notifications.
    """

    def __init__(self):
        self._telegram_enabled = bool(settings.TELEGRAM_BOT_TOKEN)

    async def check_alert_conditions(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Check all active alerts against current market data.
        Returns list of triggered alerts.
        """
        # Fetch all active alerts
        result = await db.execute(select(Alert).where(Alert.is_active == True))
        alerts: List[Alert] = result.scalars().all()

        triggered = []
        for alert in alerts:
            try:
                is_triggered = await self._evaluate_alert(alert)
                if is_triggered:
                    await self._handle_triggered_alert(alert, db)
                    triggered.append({
                        "alert_id": alert.id,
                        "user_id": alert.user_id,
                        "symbol": alert.symbol,
                        "condition": alert.condition_type,
                        "message": alert.message or f"{alert.symbol} {alert.condition_type} triggered",
                    })
            except Exception as e:
                logger.error(f"Error evaluating alert {alert.id}: {e}")

        return triggered

    async def _evaluate_alert(self, alert: Alert) -> bool:
        """Evaluate whether a single alert condition is met."""
        try:
            condition = alert.condition_type
            value = alert.condition_value

            # Price-based alerts - use live quote
            if condition in ("PRICE_ABOVE", "PRICE_BELOW", "PERCENT_CHANGE_UP", "PERCENT_CHANGE_DOWN"):
                quote = await market_data_service.fetch_quote(alert.symbol, alert.exchange)
                current_price = quote.get("price", 0)
                change_pct = quote.get("change_percent", 0)

                if condition == "PRICE_ABOVE" and current_price >= (value or 0):
                    return True
                if condition == "PRICE_BELOW" and current_price <= (value or 0):
                    return True
                if condition == "PERCENT_CHANGE_UP" and change_pct >= (value or 0):
                    return True
                if condition == "PERCENT_CHANGE_DOWN" and change_pct <= -(value or 0):
                    return True

            # Indicator-based alerts - need candle data
            elif condition in (
                "RSI_ABOVE", "RSI_BELOW", "RSI_OVERBOUGHT", "RSI_OVERSOLD",
                "MACD_CROSSOVER_BULLISH", "MACD_CROSSOVER_BEARISH",
                "SUPERTREND_BUY", "SUPERTREND_SELL",
                "BOLLINGER_UPPER", "BOLLINGER_LOWER",
            ):
                timeframe = alert.timeframe or "15m"
                df = await market_data_service.fetch_candles_as_dataframe(
                    alert.symbol, timeframe, alert.exchange, limit=100
                )
                if df is None or df.empty:
                    return False

                close = df["close"]

                if "RSI" in condition:
                    rsi = calculate_rsi(close, 14)
                    current_rsi = rsi.iloc[-1] if not rsi.empty else 50

                    if condition == "RSI_ABOVE" and current_rsi >= (value or 70):
                        return True
                    if condition == "RSI_BELOW" and current_rsi <= (value or 30):
                        return True
                    if condition == "RSI_OVERBOUGHT" and current_rsi >= 70:
                        return True
                    if condition == "RSI_OVERSOLD" and current_rsi <= 30:
                        return True

                elif "MACD" in condition:
                    macd_data = calculate_macd(close)
                    histogram = macd_data["histogram"]
                    if len(histogram) >= 2:
                        prev_hist = histogram.iloc[-2]
                        curr_hist = histogram.iloc[-1]
                        if condition == "MACD_CROSSOVER_BULLISH" and prev_hist < 0 <= curr_hist:
                            return True
                        if condition == "MACD_CROSSOVER_BEARISH" and prev_hist > 0 >= curr_hist:
                            return True

            return False

        except Exception as e:
            logger.error(f"Error evaluating alert condition {alert.condition_type}: {e}")
            return False

    async def _handle_triggered_alert(self, alert: Alert, db: AsyncSession) -> None:
        """Update alert state and send notifications."""
        alert.triggered_count += 1
        alert.triggered_at = datetime.utcnow()
        alert.last_checked_at = datetime.utcnow()

        # Deactivate if frequency is ONCE
        if alert.frequency == "ONCE":
            alert.is_active = False

        await db.commit()

        # Send notifications
        channels = alert.notification_channels or {}
        message = alert.message or f"Alert: {alert.symbol} — {alert.condition_type} triggered"

        tasks = []
        if channels.get("telegram") and self._telegram_enabled:
            tasks.append(self.send_telegram_alert(alert.user_id, message, alert))

        if channels.get("email"):
            tasks.append(self.send_email_alert(alert.user_id, message, alert))

        # WebSocket notification (browser)
        if channels.get("browser"):
            tasks.append(self._send_websocket_alert(alert.user_id, alert, message))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_telegram_alert(
        self,
        user_id: int,
        message: str,
        alert: Optional[Alert] = None,
    ) -> bool:
        """Send alert via Telegram bot."""
        if not settings.TELEGRAM_BOT_TOKEN:
            logger.debug("Telegram bot token not configured, skipping.")
            return False

        try:
            import httpx
            # Get user's telegram chat ID from DB would be needed here
            # This requires fetching user from DB - simplified for now
            chat_id = None  # Would be fetched from user.telegram_chat_id

            if not chat_id:
                logger.debug(f"No Telegram chat_id for user {user_id}")
                return False

            symbol = alert.symbol if alert else "Unknown"
            text = (
                f"🔔 *Trading Alert*\n\n"
                f"*Symbol:* {symbol}\n"
                f"*Condition:* {alert.condition_type if alert else 'Alert'}\n"
                f"*Message:* {message}\n"
                f"*Time:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
            )

            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": "Markdown",
                    },
                )
                return response.status_code == 200

        except Exception as e:
            logger.error(f"Telegram alert failed for user {user_id}: {e}")
            return False

    async def send_email_alert(
        self,
        user_id: int,
        message: str,
        alert: Optional[Alert] = None,
    ) -> bool:
        """Send alert via email (SMTP)."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.debug("SMTP not configured, skipping email alert.")
            return False

        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            # Would need user's email from DB
            recipient = None  # Fetch from user model

            if not recipient:
                return False

            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Trading Alert: {alert.symbol if alert else 'Alert'}"
            msg["From"] = settings.SMTP_USER
            msg["To"] = recipient

            html_body = f"""
            <html><body>
            <h2>Trading Alert</h2>
            <p><strong>Symbol:</strong> {alert.symbol if alert else 'N/A'}</p>
            <p><strong>Condition:</strong> {alert.condition_type if alert else 'Alert'}</p>
            <p><strong>Message:</strong> {message}</p>
            <p><strong>Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
            </body></html>
            """

            msg.attach(MIMEText(html_body, "html"))

            await asyncio.to_thread(
                lambda: self._send_smtp(msg, recipient)
            )
            return True

        except Exception as e:
            logger.error(f"Email alert failed for user {user_id}: {e}")
            return False

    def _send_smtp(self, msg, recipient: str) -> None:
        """Synchronous SMTP sending (run in thread)."""
        import smtplib
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, recipient, msg.as_string())

    async def _send_websocket_alert(
        self, user_id: int, alert: Alert, message: str
    ) -> None:
        """Send alert via WebSocket to connected browser clients."""
        try:
            from app.websocket.manager import manager
            await manager.send_alert_notification(
                user_id,
                {
                    "alert_id": alert.id,
                    "symbol": alert.symbol,
                    "condition": alert.condition_type,
                    "message": message,
                    "triggered_at": datetime.utcnow().isoformat(),
                },
            )
        except Exception as e:
            logger.error(f"WebSocket alert failed for user {user_id}: {e}")

    async def send_browser_notification(
        self, user_id: int, title: str, body: str
    ) -> bool:
        """Send browser push notification (via WebSocket)."""
        try:
            from app.websocket.manager import manager
            await manager.send_to_user(
                user_id,
                {
                    "type": "browser_notification",
                    "title": title,
                    "body": body,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )
            return True
        except Exception as e:
            logger.error(f"Browser notification failed: {e}")
            return False

    async def test_alert(self, user_id: int, channel: str = "browser") -> bool:
        """Send a test alert to verify notification setup."""
        message = f"Test alert from Trading Platform at {datetime.utcnow().strftime('%H:%M:%S')}"

        if channel == "browser":
            return await self.send_browser_notification(
                user_id, "Test Alert", message
            )
        elif channel == "telegram":
            return await self.send_telegram_alert(user_id, message)
        elif channel == "email":
            return await self.send_email_alert(user_id, message)

        return False


# Global instance
alert_service = AlertService()
