import logging
from typing import Optional
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from app.core.sockets import manager

logger = logging.getLogger(__name__)

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    Authenticated WebSocket endpoint with rate limiting.
    Supports JWT via query parameter or Sec-WebSocket-Protocol header.
    """
    # Extract token from Sec-WebSocket-Protocol if missing from query
    if not token and "sec-websocket-protocol" in websocket.headers:
        subprotocols = websocket.headers.get("sec-websocket-protocol", "").split(",")
        for sp in subprotocols:
            sp = sp.strip()
            if sp.startswith("jwt.token."):
                token = sp.replace("jwt.token.", "")
                break
                
    if not token:
        # Accept before close so the browser receives the 4003 close code
        # (pre-accept closes manifest as HTTP 403 / client code 1006).
        await websocket.accept()
        await websocket.close(code=4003, reason="Missing authentication token")
        return
    role = None  # Initialize before connect to prevent NameError in except blocks
    try:
        role = await manager.connect(websocket, token)
        if not role:
            return
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")
        return

    try:
        while True:
            # Receive message with a 60-second inactivity timeout
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                logger.warning(f"WebSocket timeout for {role} (no heartbeat for 60s)")
                break  # Exit loop to disconnect
            
            # Handle app-level ping/pong heartbeat
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
                continue
            
            try:
                import json
                parsed = json.loads(data)
                if isinstance(parsed, dict) and parsed.get("type") == "ping":
                    await websocket.send_text('{"type": "pong"}')
                    continue
            except json.JSONDecodeError:
                pass
            
            # Rate limiting check
            if not await manager.check_rate_limit(websocket):
                logger.warning(f"Rate limit exceeded for {role} connection")
                await websocket.send_text('{"error": "rate_limit_exceeded", "message": "Too many messages. Max 10/sec."}')
                continue
            
            # Simple message processing
            await websocket.send_text(f"Message received: {data}")
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if role:
            manager.disconnect(websocket, role)
