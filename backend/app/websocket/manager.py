from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional, Any, Set
import asyncio
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    WebSocket connection manager supporting:
    - Global broadcasts
    - Per-user private messages
    - Symbol-based subscriptions (market data channels)
    - Alert notifications
    """

    def __init__(self):
        # All active connections: websocket -> user_id
        self.active_connections: Dict[WebSocket, Optional[int]] = {}

        # User-specific connections: user_id -> set of websockets
        self.user_connections: Dict[int, Set[WebSocket]] = {}

        # Symbol subscriptions: symbol -> set of websockets
        self.symbol_subscriptions: Dict[str, Set[WebSocket]] = {}

        # Connection metadata
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        user_id: Optional[int] = None,
        client_id: Optional[str] = None,
    ) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[websocket] = user_id
        self.connection_metadata[websocket] = {
            "user_id": user_id,
            "client_id": client_id,
            "connected_at": datetime.utcnow().isoformat(),
            "subscribed_symbols": set(),
        }

        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(websocket)

        logger.info(f"WebSocket connected: user_id={user_id}, client_id={client_id}")

        # Send welcome message
        await self.send_personal_message(
            websocket,
            {
                "type": "connection",
                "status": "connected",
                "message": "Connected to Indian Stock Market Trading Platform",
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection and clean up subscriptions."""
        user_id = self.active_connections.pop(websocket, None)
        metadata = self.connection_metadata.pop(websocket, {})

        # Remove from user connections
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

        # Remove from all symbol subscriptions
        subscribed_symbols = metadata.get("subscribed_symbols", set())
        for symbol in subscribed_symbols:
            if symbol in self.symbol_subscriptions:
                self.symbol_subscriptions[symbol].discard(websocket)
                if not self.symbol_subscriptions[symbol]:
                    del self.symbol_subscriptions[symbol]

        logger.info(f"WebSocket disconnected: user_id={user_id}")

    async def subscribe_symbol(self, websocket: WebSocket, symbol: str) -> None:
        """Subscribe a connection to market data for a symbol."""
        symbol = symbol.upper()
        if symbol not in self.symbol_subscriptions:
            self.symbol_subscriptions[symbol] = set()
        self.symbol_subscriptions[symbol].add(websocket)

        metadata = self.connection_metadata.get(websocket)
        if metadata:
            metadata["subscribed_symbols"].add(symbol)

        await self.send_personal_message(
            websocket,
            {
                "type": "subscription",
                "status": "subscribed",
                "symbol": symbol,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
        logger.debug(f"Subscribed to {symbol}, total subscribers: {len(self.symbol_subscriptions[symbol])}")

    async def unsubscribe_symbol(self, websocket: WebSocket, symbol: str) -> None:
        """Unsubscribe a connection from a symbol's market data."""
        symbol = symbol.upper()
        if symbol in self.symbol_subscriptions:
            self.symbol_subscriptions[symbol].discard(websocket)
            if not self.symbol_subscriptions[symbol]:
                del self.symbol_subscriptions[symbol]

        metadata = self.connection_metadata.get(websocket)
        if metadata:
            metadata["subscribed_symbols"].discard(symbol)

        await self.send_personal_message(
            websocket,
            {
                "type": "subscription",
                "status": "unsubscribed",
                "symbol": symbol,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    async def send_personal_message(
        self, websocket: WebSocket, message: Dict[str, Any]
    ) -> bool:
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.warning(f"Failed to send message to websocket: {e}")
            self.disconnect(websocket)
            return False

    async def send_to_user(self, user_id: int, message: Dict[str, Any]) -> int:
        """Send a message to all connections of a specific user. Returns count sent."""
        connections = self.user_connections.get(user_id, set()).copy()
        if not connections:
            return 0
        sent = 0
        tasks = [self.send_personal_message(ws, message) for ws in connections]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        sent = sum(1 for r in results if r is True)
        return sent

    async def broadcast(self, message: Dict[str, Any]) -> int:
        """Broadcast a message to all connected clients. Returns count sent."""
        connections = list(self.active_connections.keys())
        if not connections:
            return 0
        tasks = [self.send_personal_message(ws, message) for ws in connections]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return sum(1 for r in results if r is True)

    async def broadcast_market_data(
        self, symbol: str, data: Dict[str, Any]
    ) -> int:
        """Broadcast market data to all subscribers of a symbol."""
        symbol = symbol.upper()
        subscribers = self.symbol_subscriptions.get(symbol, set()).copy()
        if not subscribers:
            return 0

        message = {
            "type": "market_data",
            "symbol": symbol,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        tasks = [self.send_personal_message(ws, message) for ws in subscribers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return sum(1 for r in results if r is True)

    async def send_alert_notification(
        self,
        user_id: int,
        alert_data: Dict[str, Any],
    ) -> bool:
        """Send an alert notification to a specific user."""
        message = {
            "type": "alert",
            "data": alert_data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        sent = await self.send_to_user(user_id, message)
        return sent > 0

    async def send_trade_update(
        self,
        user_id: int,
        trade_data: Dict[str, Any],
    ) -> bool:
        """Send a trade update to a specific user."""
        message = {
            "type": "trade_update",
            "data": trade_data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        sent = await self.send_to_user(user_id, message)
        return sent > 0

    async def send_order_update(
        self,
        user_id: int,
        order_data: Dict[str, Any],
    ) -> bool:
        """Send a broker order update to a specific user."""
        message = {
            "type": "order_update",
            "data": order_data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        sent = await self.send_to_user(user_id, message)
        return sent > 0

    async def handle_client_message(
        self, websocket: WebSocket, raw_message: str
    ) -> None:
        """Handle incoming message from client."""
        try:
            message = json.loads(raw_message)
            msg_type = message.get("type", "")

            if msg_type == "subscribe":
                symbols = message.get("symbols", [])
                for symbol in symbols:
                    await self.subscribe_symbol(websocket, symbol)

            elif msg_type == "unsubscribe":
                symbols = message.get("symbols", [])
                for symbol in symbols:
                    await self.unsubscribe_symbol(websocket, symbol)

            elif msg_type == "ping":
                await self.send_personal_message(
                    websocket,
                    {"type": "pong", "timestamp": datetime.utcnow().isoformat()},
                )

            else:
                await self.send_personal_message(
                    websocket,
                    {
                        "type": "error",
                        "message": f"Unknown message type: {msg_type}",
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                )

        except json.JSONDecodeError:
            await self.send_personal_message(
                websocket,
                {
                    "type": "error",
                    "message": "Invalid JSON message",
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )
        except Exception as e:
            logger.error(f"Error handling client message: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Return connection statistics."""
        return {
            "total_connections": len(self.active_connections),
            "authenticated_users": len(self.user_connections),
            "active_symbols": len(self.symbol_subscriptions),
            "symbol_subscriber_counts": {
                symbol: len(subs)
                for symbol, subs in self.symbol_subscriptions.items()
            },
        }


# Global singleton
manager = ConnectionManager()
