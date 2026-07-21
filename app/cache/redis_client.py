"""
Redis cache layer.

Provides a thin async wrapper around redis-py with:
  - Auto-connection from APP_REDIS_URL env var (read lazily, not at import time)
  - get / set / delete / invalidate_prefix helpers
  - cached() decorator for async functions
  - close_redis() for graceful shutdown
  - Graceful fallback (no-op) when Redis is unavailable

Usage
-----
    from app.cache.redis_client import cache, cached, invalidate

    # Decorator
    @cached("analytics:overview:{user_id}", ttl=300)
    async def get_overview(user_id: int): ...

    # Manual
    await cache.set("key", value, ttl=60)
    val = await cache.get("key")
    await invalidate("analytics:*")

    # Graceful shutdown (call from lifespan)
    from app.cache.redis_client import close_redis
    await close_redis()
"""
from __future__ import annotations

import functools
import json
import logging
import os
from typing import Any, Callable

_log = logging.getLogger(__name__)

_client: Any = None  # redis.asyncio.Redis | None


def _get_redis_url() -> str:
    """Read the Redis URL from the environment lazily (not at import time)."""
    return os.environ.get("APP_REDIS_URL", "")


def _get_client() -> Any:
    global _client
    if _client is not None:
        return _client
    redis_url = _get_redis_url()
    if not redis_url:
        return None
    try:
        import redis.asyncio as aioredis
        _client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    except Exception as exc:
        _log.warning(f"Redis unavailable — caching disabled: {exc}")
        _client = None
    return _client


async def close_redis() -> None:
    """Close the Redis connection pool gracefully. Called from lifespan shutdown."""
    global _client
    if _client is None:
        return
    try:
        await _client.aclose()
        _log.info("Redis connection pool closed")
    except Exception as exc:
        _log.debug(f"Redis close error: {exc}")
    finally:
        _client = None


class CacheClient:
    """Thin async Redis wrapper with JSON serialisation."""

    async def get(self, key: str) -> Any | None:
        client = _get_client()
        if not client:
            return None
        try:
            raw = await client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception as exc:
            _log.debug(f"Cache GET error [{key}]: {exc}")
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        client = _get_client()
        if not client:
            return
        try:
            await client.setex(key, ttl, json.dumps(value, default=str))
        except Exception as exc:
            _log.debug(f"Cache SET error [{key}]: {exc}")

    async def delete(self, key: str) -> None:
        client = _get_client()
        if not client:
            return
        try:
            await client.delete(key)
        except Exception as exc:
            _log.debug(f"Cache DEL error [{key}]: {exc}")

    async def invalidate_prefix(self, prefix: str) -> int:
        """Delete all keys matching prefix* — uses SCAN for safety."""
        client = _get_client()
        if not client:
            return 0
        try:
            count = 0
            async for key in client.scan_iter(f"{prefix}*"):
                await client.delete(key)
                count += 1
            return count
        except Exception as exc:
            _log.debug(f"Cache SCAN error [{prefix}*]: {exc}")
            return 0

    async def ping(self) -> bool:
        client = _get_client()
        if not client:
            return False
        try:
            return await client.ping()
        except Exception:
            return False


cache = CacheClient()


async def invalidate(prefix: str) -> int:
    """Convenience function — delete all keys with given prefix."""
    return await cache.invalidate_prefix(prefix)


def cached(key_template: str, ttl: int = 300) -> Callable:
    """
    Async function decorator that caches the result in Redis.

    key_template uses Python str.format() with the function's kwargs.
    Example: @cached("analytics:overview:{user_id}", ttl=300)
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Build cache key using kwargs (and positional args by index)
            try:
                key = key_template.format(*args, **kwargs)
            except (IndexError, KeyError):
                key = key_template
            hit = await cache.get(key)
            if hit is not None:
                return hit
            result = await fn(*args, **kwargs)
            if result is not None:
                try:
                    await cache.set(
                        key,
                        result if not hasattr(result, "model_dump") else result.model_dump(),
                        ttl=ttl,
                    )
                except Exception:
                    pass
            return result
        return wrapper
    return decorator
