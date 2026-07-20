"""
WebSocket router — real-time notifications.

Endpoint: ws://.../ws/notifications?token=<JWT>

The client authenticates via a JWT query parameter (same secret as HTTP auth).
After authentication the server subscribes to a Redis pub/sub channel
``ws:user:{user_id}`` and forwards every published message to the WebSocket.

Workers and services publish to that channel via _notify_ws() in celery_app.py.

Events emitted
--------------
  review_complete       — AI review finished
  security_complete     — Security scan finished
  api_analysis_complete — API quality analysis finished
  tests_complete        — Test generation finished
  report_complete       — Enterprise report ready
  invite_accepted       — Workspace invite accepted
  notification          — Generic notification
"""
from __future__ import annotations

import asyncio
import json
import logging
import os

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

_log = logging.getLogger(__name__)

router = APIRouter(tags=["WebSockets"])

REDIS_URL = os.environ.get("APP_REDIS_URL", "")


def _decode_token(token: str) -> int | None:
    """Return user_id from JWT or None if invalid."""
    try:
        from app.auth.jwt import decode_access_token
        payload = decode_access_token(token)
        sub = payload.get("sub")
        return int(sub) if sub else None
    except Exception:
        return None


@router.websocket("/ws/notifications")
async def notifications_ws(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
) -> None:
    """Real-time notification WebSocket endpoint."""
    user_id = _decode_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()
    _log.info(f"WS connected: user_id={user_id}")

    if not REDIS_URL:
        # No Redis — keep connection alive, no messages
        try:
            while True:
                await asyncio.sleep(30)
                await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            return

    # ── Redis pub/sub listener ──────────────────────────────────────────────
    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
        pubsub = redis_client.pubsub()
        channel = f"ws:user:{user_id}"
        await pubsub.subscribe(channel)

        async def _listen() -> None:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await websocket.send_json(data)
                    except Exception as exc:
                        _log.debug(f"WS send error: {exc}")
                        break

        async def _heartbeat() -> None:
            while True:
                await asyncio.sleep(20)
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

        listener_task = asyncio.create_task(_listen())
        heartbeat_task = asyncio.create_task(_heartbeat())

        try:
            # Wait for client disconnect
            while True:
                try:
                    msg = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                    if msg == "pong":
                        continue
                except asyncio.TimeoutError:
                    pass
                except WebSocketDisconnect:
                    break
        finally:
            listener_task.cancel()
            heartbeat_task.cancel()
            await pubsub.unsubscribe(channel)
            await redis_client.aclose()

    except ImportError:
        _log.warning("redis package not installed — WebSocket notifications unavailable")
        try:
            while True:
                await asyncio.sleep(30)
                await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            pass
    except WebSocketDisconnect:
        pass
    finally:
        _log.info(f"WS disconnected: user_id={user_id}")
