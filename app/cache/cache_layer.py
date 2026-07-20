"""
Cache layer for high-read endpoints.

This module wraps existing service calls with Redis caching.
It does NOT modify any business logic — it only adds a read-through
cache in front of existing service functions.

Services wrapped
----------------
  analytics_service  — overview, repositories, trends, models, security, performance
  workspace_service  — get_dashboard, get_notifications
  history_service    — list_reviews (short TTL, invalidated on delete)

TTLs
----
  analytics   : 300s (5 min) — changes rarely
  workspace   : 120s (2 min) — changes moderately
  history     : 60s  (1 min) — changes on new reviews
  notifications: 30s         — changes frequently

Cache key format
----------------
  <module>:<function>:<user_id>:<param_hash>
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from app.cache.redis_client import cache


def _hash(*args: Any, **kwargs: Any) -> str:
    """Stable short hash of arbitrary positional + keyword arguments."""
    raw = json.dumps({"a": args, "k": kwargs}, sort_keys=True, default=str)
    return hashlib.md5(raw.encode()).hexdigest()[:10]  # noqa: S324  # non-security hash


# ── Analytics (TTL 300s) ──────────────────────────────────────────────────────

async def get_overview_cached(user_id: int, **kwargs: Any) -> Any:
    from app.services.analytics_service import get_overview
    key = f"analytics:overview:{user_id}:{_hash(**kwargs)}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.analytics import OverviewMetrics
        return OverviewMetrics(**hit)
    result = await get_overview(user_id, **kwargs)
    await cache.set(key, result.model_dump(), ttl=300)
    return result


async def get_repository_analytics_cached(user_id: int, **kwargs: Any) -> Any:
    from app.services.analytics_service import get_repository_analytics
    key = f"analytics:repos:{user_id}:{_hash(**kwargs)}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.analytics import RepositoryAnalyticsList
        return RepositoryAnalyticsList(**hit)
    result = await get_repository_analytics(user_id, **kwargs)
    await cache.set(key, result.model_dump(), ttl=300)
    return result


async def get_trends_cached(user_id: int, **kwargs: Any) -> Any:
    from app.services.analytics_service import get_trends
    key = f"analytics:trends:{user_id}:{_hash(**kwargs)}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.analytics import TrendAnalytics
        return TrendAnalytics(**hit)
    result = await get_trends(user_id, **kwargs)
    await cache.set(key, result.model_dump(), ttl=300)
    return result


async def get_model_analytics_cached(user_id: int, **kwargs: Any) -> Any:
    from app.services.analytics_service import get_model_analytics
    key = f"analytics:models:{user_id}:{_hash(**kwargs)}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.analytics import ModelAnalyticsList
        return ModelAnalyticsList(**hit)
    result = await get_model_analytics(user_id, **kwargs)
    await cache.set(key, result.model_dump(), ttl=300)
    return result


async def get_security_analytics_cached(user_id: int, **kwargs: Any) -> Any:
    from app.services.analytics_service import get_security_analytics
    key = f"analytics:security:{user_id}:{_hash(**kwargs)}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.analytics import SecurityAnalytics
        return SecurityAnalytics(**hit)
    result = await get_security_analytics(user_id, **kwargs)
    await cache.set(key, result.model_dump(), ttl=300)
    return result


async def get_performance_analytics_cached(user_id: int, **kwargs: Any) -> Any:
    from app.services.analytics_service import get_performance_analytics
    key = f"analytics:performance:{user_id}:{_hash(**kwargs)}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.analytics import PerformanceAnalytics
        return PerformanceAnalytics(**hit)
    result = await get_performance_analytics(user_id, **kwargs)
    await cache.set(key, result.model_dump(), ttl=300)
    return result


# ── History (TTL 60s, invalidated on delete) ──────────────────────────────────

async def list_reviews_cached(user_id: int, **kwargs: Any) -> Any:
    from app.services.history_service import list_reviews
    key = f"history:list:{user_id}:{_hash(**kwargs)}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.history import PaginatedReviewList
        return PaginatedReviewList(**hit)
    result = await list_reviews(user_id, **kwargs)
    await cache.set(key, result.model_dump(), ttl=60)
    return result


async def invalidate_history_cache(user_id: int) -> None:
    """Call after delete or new review to clear user's history cache."""
    await cache.invalidate_prefix(f"history:list:{user_id}:")


# ── Workspace dashboard (TTL 120s) ────────────────────────────────────────────

async def get_dashboard_cached(workspace_id: int, user_id: int) -> Any:
    from app.services.workspace_service import get_dashboard
    key = f"workspace:dashboard:{workspace_id}:{user_id}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.workspace import WorkspaceDashboard
        return WorkspaceDashboard(**hit)
    result = await get_dashboard(workspace_id, user_id)
    await cache.set(key, result.model_dump(), ttl=120)
    return result


async def invalidate_workspace_cache(workspace_id: int) -> None:
    """Call after workspace mutations to clear dashboard cache."""
    await cache.invalidate_prefix(f"workspace:dashboard:{workspace_id}:")


# ── Notifications (TTL 30s) ───────────────────────────────────────────────────

async def get_notifications_cached(user_id: int, unread_only: bool = False) -> Any:
    from app.services.workspace_service import get_notifications
    key = f"notifications:{user_id}:{unread_only}"
    hit = await cache.get(key)
    if hit is not None:
        from app.schemas.workspace import NotificationList
        return NotificationList(**hit)
    result = await get_notifications(user_id, unread_only)
    await cache.set(key, result.model_dump(), ttl=30)
    return result


async def invalidate_notifications_cache(user_id: int) -> None:
    """Call after mark-read to clear notification cache."""
    await cache.invalidate_prefix(f"notifications:{user_id}:")
