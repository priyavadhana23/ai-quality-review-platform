"""Pydantic schemas for Review History API endpoints."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


# ── Shared sub-models ─────────────────────────────────────────────────────────

class ReviewMetricsResponse(BaseModel):
    bugs_found: int = 0
    suggestions: int = 0
    security_score: int | None = None
    quality_score: int | None = None
    complexity_score: int | None = None
    maintainability_score: int | None = None


# ── List item (returned by GET /api/v1/history) ───────────────────────────────

class ReviewListItem(BaseModel):
    """Compact review card — no full markdown to keep the list payload small."""

    id: int
    tool: str
    review_type: str
    review_summary: str | None
    execution_time: float
    llm_model: str | None
    tokens_used: int | None
    created_at: str
    pr_url: str
    pr_number: int
    pr_title: str | None
    github_owner: str
    github_repo: str
    bugs_found: int | None = None
    suggestions: int | None = None
    security_score: int | None = None
    quality_score: int | None = None

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "ReviewListItem":
        return cls(**row)


class PaginatedReviewList(BaseModel):
    """Paginated history response."""

    items: list[ReviewListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Detail item (returned by GET /api/v1/history/{id}) ───────────────────────

class ReviewDetail(BaseModel):
    """Full review detail including markdown."""

    id: int
    tool: str
    review_type: str
    review_summary: str | None
    review_markdown: str
    execution_time: float
    llm_model: str | None
    tokens_used: int | None
    created_at: str
    pr_url: str
    pr_number: int
    pr_title: str | None
    branch: str | None
    author: str | None
    github_owner: str
    github_repo: str
    metrics: ReviewMetricsResponse | None = None

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "ReviewDetail":
        metrics = None
        if any(row.get(k) is not None for k in ("bugs_found", "suggestions", "security_score")):
            metrics = ReviewMetricsResponse(
                bugs_found=row.get("bugs_found") or 0,
                suggestions=row.get("suggestions") or 0,
                security_score=row.get("security_score"),
                quality_score=row.get("quality_score"),
                complexity_score=row.get("complexity_score"),
                maintainability_score=row.get("maintainability_score"),
            )
        return cls(
            id=row["id"],
            tool=row["tool"],
            review_type=row["review_type"],
            review_summary=row.get("review_summary"),
            review_markdown=row["review_markdown"],
            execution_time=row["execution_time"],
            llm_model=row.get("llm_model"),
            tokens_used=row.get("tokens_used"),
            created_at=row["created_at"],
            pr_url=row["pr_url"],
            pr_number=row["pr_number"],
            pr_title=row.get("pr_title"),
            branch=row.get("branch"),
            author=row.get("author"),
            github_owner=row["github_owner"],
            github_repo=row["github_repo"],
            metrics=metrics,
        )


# ── Repositories & Pull Requests ──────────────────────────────────────────────

class RepositoryResponse(BaseModel):
    id: int
    github_owner: str
    github_repo: str
    created_at: str
    pr_count: int = 0

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "RepositoryResponse":
        return cls(**row)


class PullRequestResponse(BaseModel):
    id: int
    pr_number: int
    pr_url: str
    title: str | None
    branch: str | None
    author: str | None
    status: str
    created_at: str
    github_owner: str
    github_repo: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "PullRequestResponse":
        return cls(**row)
