"""
Health check router.

GET /health        — shallow liveness probe (no dependency checks, always fast)
GET /health/detail — deep readiness probe: database, Redis, Celery, WebSocket

The shallow probe is used by load balancers and Docker healthchecks.
The detail probe is used by monitoring dashboards and alerting systems.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter

from app.cache.redis_client import cache
from app.core.config import get_app_settings
from app.schemas.common import ComponentHealth, HealthResponse

router = APIRouter(tags=["Health"])
_log = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _check_database() -> ComponentHealth:
    """Verify the database is reachable with a lightweight query."""
    try:
        from app.db import fetchone
        row = await asyncio.wait_for(fetchone("SELECT 1 AS ok"), timeout=3.0)
        if row and row.get("ok") == 1:
            return ComponentHealth(status="ok")
        return ComponentHealth(status="degraded", detail="Unexpected query result")
    except asyncio.TimeoutError:
        return ComponentHealth(status="unavailable", detail="Query timed out")
    except Exception as exc:
        return ComponentHealth(status="unavailable", detail=str(exc)[:120])


async def _check_redis() -> ComponentHealth:
    """Verify Redis responds to PING."""
    try:
        ok = await asyncio.wait_for(cache.ping(), timeout=2.0)
        if ok:
            return ComponentHealth(status="ok")
        return ComponentHealth(status="unavailable", detail="PING returned False")
    except asyncio.TimeoutError:
        return ComponentHealth(status="unavailable", detail="PING timed out")
    except Exception as exc:
        return ComponentHealth(status="unavailable", detail=str(exc)[:120])


async def _check_celery() -> ComponentHealth:
    """Verify at least one Celery worker is active via broker inspect."""
    try:
        import concurrent.futures

        from app.workers.celery_app import app as celery_app

        def _inspect() -> bool:
            inspector = celery_app.control.inspect(timeout=3.0)
            active = inspector.active()
            return bool(active)

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            alive = await asyncio.wait_for(
                loop.run_in_executor(pool, _inspect), timeout=5.0
            )
        if alive:
            return ComponentHealth(status="ok")
        return ComponentHealth(status="degraded", detail="No active workers found")
    except asyncio.TimeoutError:
        return ComponentHealth(status="degraded", detail="Inspect timed out — workers may be starting")
    except ImportError:
        return ComponentHealth(status="unavailable", detail="Celery not installed")
    except Exception as exc:
        return ComponentHealth(status="unavailable", detail=str(exc)[:120])


def _check_websocket() -> ComponentHealth:
    """Verify WebSocket route is registered (sync, no I/O needed)."""
    try:
        from app.routers.ws import router as ws_router
        ws_routes = [r for r in ws_router.routes if hasattr(r, "path") and "/ws" in r.path]
        if ws_routes:
            return ComponentHealth(status="ok", detail=f"{len(ws_routes)} route(s) registered")
        return ComponentHealth(status="degraded", detail="No WebSocket routes found")
    except Exception as exc:
        return ComponentHealth(status="unavailable", detail=str(exc)[:120])


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
    description=(
        "Returns HTTP 200 immediately when the process is running. "
        "Does not check database or Redis — use GET /health/detail for that."
    ),
)
async def health_check() -> HealthResponse:
    """Fast liveness probe — always returns ok if the process is up."""
    settings = get_app_settings()
    return HealthResponse(version=settings.app_version)


@router.get(
    "/health/detail",
    response_model=HealthResponse,
    summary="Readiness probe",
    description=(
        "Performs live checks against database, Redis, Celery, and WebSocket. "
        "Returns `status=ok` only when all critical components are healthy. "
        "Returns `status=degraded` when non-critical components are down."
    ),
)
async def health_detail() -> HealthResponse:
    """Deep readiness probe — checks all downstream dependencies in parallel."""
    settings = get_app_settings()

    # Run all async checks concurrently; WebSocket check is sync
    db_result, redis_result, celery_result = await asyncio.gather(
        _check_database(),
        _check_redis(),
        _check_celery(),
        return_exceptions=False,
    )
    ws_result = _check_websocket()

    components: dict[str, ComponentHealth] = {
        "database": db_result,
        "redis": redis_result,
        "celery": celery_result,
        "websocket": ws_result,
    }

    # Overall status: degraded if any critical component is not ok
    critical = {"database", "redis"}
    overall = "ok"
    for name, comp in components.items():
        if name in critical and comp.status != "ok":
            overall = "degraded"
            break

    return HealthResponse(
        status=overall,
        version=settings.app_version,
        components=components,
    )
