"""
Analytics router.

All endpoints require a valid Bearer JWT.  Every query is scoped to
current_user.id — users cannot see each other's analytics (IDOR prevention).

Responses are served from Redis cache (TTL 300 s) when available.
Cache keys are invalidated automatically on new reviews via the cache layer.

Routes
------
GET /api/v1/analytics/overview       — aggregate KPIs
GET /api/v1/analytics/repositories   — per-repository metrics
GET /api/v1/analytics/trends         — daily / weekly / monthly time-series
GET /api/v1/analytics/models         — per-LLM-model usage
GET /api/v1/analytics/security       — security / bug metrics
GET /api/v1/analytics/performance    — execution time statistics
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.cache.cache_layer import (
    get_model_analytics_cached,
    get_overview_cached,
    get_performance_analytics_cached,
    get_repository_analytics_cached,
    get_security_analytics_cached,
    get_trends_cached,
)
from app.schemas.analytics import (
    ModelAnalyticsList,
    OverviewMetrics,
    PerformanceAnalytics,
    RepositoryAnalyticsList,
    SecurityAnalytics,
    TrendAnalytics,
)
from app.schemas.common import ErrorResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])

# ── Shared query-param defaults ───────────────────────────────────────────────
_REPO = Query(None, description="Filter by owner, repo, or owner/repo")
_TOOL = Query(None, description="Filter by tool (review/describe/improve/ask)")
_MODEL = Query(None, description="Filter by LLM model name")
_DATE_FROM = Query(None, description="Start date inclusive (YYYY-MM-DD)")
_DATE_TO = Query(None, description="End date inclusive (YYYY-MM-DD)")


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get(
    "/overview",
    response_model=OverviewMetrics,
    responses={401: {"model": ErrorResponse}},
    summary="Analytics overview",
    description="Aggregate KPIs across all reviews. Cached 300 s. **Requires authentication.**",
)
async def analytics_overview(
    repo: str | None = _REPO,
    tool: str | None = _TOOL,
    model: str | None = _MODEL,
    date_from: str | None = _DATE_FROM,
    date_to: str | None = _DATE_TO,
    current_user: UserResponse = Depends(get_current_user),
) -> OverviewMetrics:
    return await get_overview_cached(
        current_user.id, repo=repo, tool=tool, model=model,
        date_from=date_from, date_to=date_to,
    )


# ── Repository analytics ──────────────────────────────────────────────────────

@router.get(
    "/repositories",
    response_model=RepositoryAnalyticsList,
    responses={401: {"model": ErrorResponse}},
    summary="Per-repository analytics",
    description="Review count, scores, and timing per repository. Cached 300 s. **Requires authentication.**",
)
async def analytics_repositories(
    tool: str | None = _TOOL,
    model: str | None = _MODEL,
    date_from: str | None = _DATE_FROM,
    date_to: str | None = _DATE_TO,
    current_user: UserResponse = Depends(get_current_user),
) -> RepositoryAnalyticsList:
    return await get_repository_analytics_cached(
        current_user.id, tool=tool, model=model,
        date_from=date_from, date_to=date_to,
    )


# ── Trends ────────────────────────────────────────────────────────────────────

@router.get(
    "/trends",
    response_model=TrendAnalytics,
    responses={401: {"model": ErrorResponse}},
    summary="Trend analytics",
    description=(
        "Daily (30 days), weekly (12 weeks), and monthly (12 months) time-series. "
        "Cached 300 s. **Requires authentication.**"
    ),
)
async def analytics_trends(
    repo: str | None = _REPO,
    tool: str | None = _TOOL,
    model: str | None = _MODEL,
    date_from: str | None = _DATE_FROM,
    date_to: str | None = _DATE_TO,
    current_user: UserResponse = Depends(get_current_user),
) -> TrendAnalytics:
    return await get_trends_cached(
        current_user.id, repo=repo, tool=tool, model=model,
        date_from=date_from, date_to=date_to,
    )


# ── Model analytics ───────────────────────────────────────────────────────────

@router.get(
    "/models",
    response_model=ModelAnalyticsList,
    responses={401: {"model": ErrorResponse}},
    summary="AI model usage analytics",
    description="Per-LLM-model review counts and response times. Cached 300 s. **Requires authentication.**",
)
async def analytics_models(
    repo: str | None = _REPO,
    tool: str | None = _TOOL,
    date_from: str | None = _DATE_FROM,
    date_to: str | None = _DATE_TO,
    current_user: UserResponse = Depends(get_current_user),
) -> ModelAnalyticsList:
    return await get_model_analytics_cached(
        current_user.id, repo=repo, tool=tool,
        date_from=date_from, date_to=date_to,
    )


# ── Security analytics ────────────────────────────────────────────────────────

@router.get(
    "/security",
    response_model=SecurityAnalytics,
    responses={401: {"model": ErrorResponse}},
    summary="Security analytics",
    description="Bugs found, security scores, and distribution. Cached 300 s. **Requires authentication.**",
)
async def analytics_security(
    repo: str | None = _REPO,
    tool: str | None = _TOOL,
    date_from: str | None = _DATE_FROM,
    date_to: str | None = _DATE_TO,
    current_user: UserResponse = Depends(get_current_user),
) -> SecurityAnalytics:
    return await get_security_analytics_cached(
        current_user.id, repo=repo, tool=tool,
        date_from=date_from, date_to=date_to,
    )


# ── Performance analytics ─────────────────────────────────────────────────────

@router.get(
    "/performance",
    response_model=PerformanceAnalytics,
    responses={401: {"model": ErrorResponse}},
    summary="Performance analytics",
    description=(
        "Fastest, slowest, average, p95 execution times and per-tool breakdown. "
        "Cached 300 s. **Requires authentication.**"
    ),
)
async def analytics_performance(
    repo: str | None = _REPO,
    tool: str | None = _TOOL,
    model: str | None = _MODEL,
    date_from: str | None = _DATE_FROM,
    date_to: str | None = _DATE_TO,
    current_user: UserResponse = Depends(get_current_user),
) -> PerformanceAnalytics:
    return await get_performance_analytics_cached(
        current_user.id, repo=repo, tool=tool, model=model,
        date_from=date_from, date_to=date_to,
    )
