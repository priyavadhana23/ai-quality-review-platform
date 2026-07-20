"""Pydantic schemas for the Analytics API endpoints."""
from __future__ import annotations

from pydantic import BaseModel, Field


# ── Overview ──────────────────────────────────────────────────────────────────

class OverviewMetrics(BaseModel):
    """Aggregate metrics across all reviews for the authenticated user."""

    total_reviews: int = Field(0, description="Total number of reviews stored")
    repositories_analysed: int = Field(0, description="Distinct repositories reviewed")
    pull_requests_reviewed: int = Field(0, description="Distinct pull requests reviewed")
    avg_review_time: float = Field(0.0, description="Average execution time in seconds")
    avg_quality_score: float | None = Field(None, description="Average quality score (0-100)")
    avg_security_score: float | None = Field(None, description="Average security score (0-100)")
    avg_maintainability_score: float | None = Field(None, description="Average maintainability score")
    avg_complexity_score: float | None = Field(None, description="Average complexity score")
    avg_bugs_found: float = Field(0.0, description="Average bugs found per review")
    avg_suggestions: float = Field(0.0, description="Average suggestions per review")
    most_used_model: str | None = Field(None, description="Most frequently used LLM model")
    latest_review_date: str | None = Field(None, description="ISO-8601 datetime of most recent review")
    reviews_by_tool: dict[str, int] = Field(
        default_factory=dict, description="Count of reviews per tool"
    )


# ── Repository analytics ──────────────────────────────────────────────────────

class RepositoryAnalytics(BaseModel):
    """Per-repository metrics."""

    github_owner: str
    github_repo: str
    repo_label: str = Field(description="owner/repo string")
    review_count: int = 0
    avg_quality_score: float | None = None
    avg_security_score: float | None = None
    avg_review_time: float = 0.0
    avg_bugs_found: float = 0.0
    avg_suggestions: float = 0.0
    last_reviewed_date: str | None = None


class RepositoryAnalyticsList(BaseModel):
    items: list[RepositoryAnalytics]


# ── Trend analytics ───────────────────────────────────────────────────────────

class TrendDataPoint(BaseModel):
    """A single point on a time-series chart."""

    date: str = Field(description="ISO date string (YYYY-MM-DD or YYYY-WXX or YYYY-MM)")
    reviews: int = 0
    avg_quality: float | None = None
    avg_security: float | None = None
    avg_review_time: float | None = None


class TrendAnalytics(BaseModel):
    daily: list[TrendDataPoint] = Field(default_factory=list, description="Last 30 days")
    weekly: list[TrendDataPoint] = Field(default_factory=list, description="Last 12 weeks")
    monthly: list[TrendDataPoint] = Field(default_factory=list, description="Last 12 months")


# ── Model analytics ───────────────────────────────────────────────────────────

class ModelAnalytics(BaseModel):
    """Per-LLM-model usage statistics."""

    model_name: str
    review_count: int = 0
    avg_response_time: float = 0.0
    avg_tokens: float | None = None
    pct_of_total: float = 0.0


class ModelAnalyticsList(BaseModel):
    items: list[ModelAnalytics]
    total_reviews: int = 0


# ── Security analytics ────────────────────────────────────────────────────────

class SecurityAnalytics(BaseModel):
    """Security-focused aggregate metrics."""

    avg_security_score: float | None = None
    total_bugs_found: int = 0
    reviews_with_bugs: int = 0
    pct_reviews_with_bugs: float = 0.0
    score_distribution: list[dict] = Field(
        default_factory=list,
        description="Buckets: [{range: '0-20', count: 3}, ...]",
    )
    top_repos_by_bugs: list[dict] = Field(
        default_factory=list,
        description="[{repo: 'owner/repo', bugs: 5}]",
    )


# ── Performance analytics ─────────────────────────────────────────────────────

class PerformanceAnalytics(BaseModel):
    """Review execution time statistics."""

    fastest_review: float = 0.0
    slowest_review: float = 0.0
    avg_review_time: float = 0.0
    p95_review_time: float = 0.0
    total_ai_processing_time: float = 0.0
    time_by_tool: list[dict] = Field(
        default_factory=list,
        description="[{tool: 'review', avg_time: 4.2, count: 10}]",
    )


# ── Shared filter params (used as query params) ───────────────────────────────

class AnalyticsFilterParams(BaseModel):
    """Optional query params accepted by all analytics endpoints."""

    repo: str | None = None
    tool: str | None = None
    model: str | None = None
    date_from: str | None = None
    date_to: str | None = None
