import logging
import time
from typing import Dict, Set
from fastapi import WebSocket, status, Query
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from app.core.config import settings

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "ADMIN": set(),
            "MANAGER": set(),
            "DRIVER": set(),
        }
        self.rate_limits: Dict[WebSocket, list] = {}

    async def connect(self, websocket: WebSocket, token: str):
        """Authenticates and accepts the WebSocket connection.

        NOTE: We must call accept() before close(code=...) for application-level
        auth failures so the browser actually receives the custom close code.
        Closing before accept aborts the HTTP upgrade with 403 and the client
        sees only 1006 (abnormal closure).
        """
        # Echo a subprotocol if the client requested one.
        subprotocol = None
        if websocket.scope.get("subprotocols"):
            for sp in websocket.scope["subprotocols"]:
                if sp.startswith("jwt.token."):
                    subprotocol = sp
                    break

        await websocket.accept(subprotocol=subprotocol)

        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except ExpiredSignatureError:
            logger.info("WebSocket rejected: token expired")
            # 4401 signals the client to refresh its access token and reconnect.
            await websocket.close(code=4401, reason="Token expired")
            return None
        except JWTError as e:
            logger.warning(f"WebSocket rejected: invalid token ({e})")
            await websocket.close(code=4003, reason="Invalid token")
            return None

        role = payload.get("role")
        if not role or role not in self.active_connections:
            await websocket.close(code=4003, reason="Invalid role or unauthorized")
            return None

        self.active_connections[role].add(websocket)
        self.rate_limits[websocket] = []
        logger.info(f"New client connected with role: {role}")
        return role

    def disconnect(self, websocket: WebSocket, role: str):
        if role in self.active_connections:
            self.active_connections[role].discard(websocket)
        self.rate_limits.pop(websocket, None)
        logger.info(f"Client disconnected from role: {role}")

    async def check_rate_limit(self, websocket: WebSocket) -> bool:
        """Simple rate limiting: max 10 messages per second."""
        now = time.time()
        if websocket not in self.rate_limits:
            self.rate_limits[websocket] = []

        # Keep only timestamps within the last second
        self.rate_limits[websocket] = [t for t in self.rate_limits[websocket] if now - t < 1.0]

        if len(self.rate_limits[websocket]) >= 10:
            return False

        self.rate_limits[websocket].append(now)
        return True

    async def broadcast_to_role(self, role: str, message: dict):
        if role in self.active_connections:
            disconnected = set()
            for connection in tuple(self.active_connections[role]):  # Iterate copy to avoid RuntimeError
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            for conn in disconnected:
                self.active_connections[role].discard(conn)
                self.rate_limits.pop(conn, None)

    async def broadcast_to_all(self, message: dict):
        for role in self.active_connections:
            await self.broadcast_to_role(role, message)

manager = ConnectionManager()
