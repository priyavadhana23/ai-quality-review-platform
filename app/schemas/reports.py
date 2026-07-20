"""Pydantic schemas for the Enterprise Report Generator API endpoints."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

# ── Constants ─────────────────────────────────────────────────────────────────

REPORT_TYPES = Literal[
    "executive",
    "developer",
    "qa",
    "security",
    "api_quality",
    "full",
]

REPORT_FORMATS = Literal["markdown", "html", "json"]

REPORT_TYPE_LABELS: dict[str, str] = {
    "executive": "Executive Report",
    "developer": "Developer Report",
    "qa": "QA Report",
    "security": "Security Report",
    "api_quality": "API Quality Report",
    "full": "Full Engineering Report",
}

REPORT_FORMAT_LABELS: dict[str, str] = {
    "markdown": "Markdown",
    "html": "HTML",
    "json": "JSON",
}

# Modules that can be included in a report
AVAILABLE_MODULES = Literal[
    "reviews",
    "security",
    "api_quality",
    "tests",
    "analytics",
]


# ── Request ───────────────────────────────────────────────────────────────────

class ReportGenerateRequest(BaseModel):
    """Input for POST /api/v1/reports/generate."""

    report_type: REPORT_TYPES = Field("full", description="Type of report to generate")
    report_format: REPORT_FORMATS = Field("markdown", description="Output format")
    report_title: str = Field("", description="Optional custom title")
    repository: str | None = Field(None, description="Filter by repository (owner/repo)")
    pull_request: str | None = Field(None, description="Filter by PR URL or number")
    date_from: str | None = Field(None, description="Start date (YYYY-MM-DD)")
    date_to: str | None = Field(None, description="End date (YYYY-MM-DD)")
    modules: list[str] = Field(
        default_factory=list,
        description="Modules to include. Empty = all available.",
    )

    @field_validator("report_title")
    @classmethod
    def default_title(cls, v: str, info: Any) -> str:
        return v.strip() or ""

    @field_validator("modules")
    @classmethod
    def validate_modules(cls, v: list[str]) -> list[str]:
        valid = {"reviews", "security", "api_quality", "tests", "analytics"}
        return [m for m in v if m in valid] or []


# ── Sub-models for the aggregated payload ────────────────────────────────────

class ReviewSummarySection(BaseModel):
    total_reviews: int = 0
    tools_used: dict[str, int] = Field(default_factory=dict)
    avg_quality_score: float | None = None
    avg_security_score: float | None = None
    avg_bugs_found: float = 0.0
    avg_suggestions: float = 0.0
    avg_execution_time: float = 0.0
    recent_reviews: list[dict[str, Any]] = Field(default_factory=list)


class SecuritySection(BaseModel):
    total_scans: int = 0
    avg_security_score: float | None = None
    total_critical: int = 0
    total_high: int = 0
    total_medium: int = 0
    total_low: int = 0
    top_owasp_categories: list[str] = Field(default_factory=list)
    top_cwe_ids: list[str] = Field(default_factory=list)
    recent_scans: list[dict[str, Any]] = Field(default_factory=list)


class ApiQualitySection(BaseModel):
    total_reports: int = 0
    avg_quality_score: float | None = None
    avg_security_score: float | None = None
    avg_documentation_score: float | None = None
    avg_design_score: float | None = None
    avg_validation_score: float | None = None
    total_endpoints_analysed: int = 0
    recent_reports: list[dict[str, Any]] = Field(default_factory=list)


class TestGeneratorSection(BaseModel):
    total_generated: int = 0
    languages_used: dict[str, int] = Field(default_factory=dict)
    frameworks_used: dict[str, int] = Field(default_factory=dict)
    avg_coverage_score: float | None = None
    avg_confidence_score: float | None = None
    recent_tests: list[dict[str, Any]] = Field(default_factory=list)


class AnalyticsSection(BaseModel):
    repositories_analysed: int = 0
    pull_requests_reviewed: int = 0
    most_used_model: str | None = None
    avg_review_time: float = 0.0
    top_repositories: list[dict[str, Any]] = Field(default_factory=list)


class EngineeringHealthScore(BaseModel):
    overall: float | None = None
    review_coverage: float | None = None
    security_posture: float | None = None
    api_quality: float | None = None
    test_coverage: float | None = None
    explanation: str = ""


class ReportPayload(BaseModel):
    """The full aggregated data payload stored as JSON."""

    report_type: str
    repository: str | None = None
    pull_request: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    modules_included: list[str] = Field(default_factory=list)
    engineering_health: EngineeringHealthScore = Field(
        default_factory=EngineeringHealthScore
    )
    reviews: ReviewSummarySection | None = None
    security: SecuritySection | None = None
    api_quality: ApiQualitySection | None = None
    tests: TestGeneratorSection | None = None
    analytics: AnalyticsSection | None = None
    recommendations: list[str] = Field(default_factory=list)


# ── Response: full report ────────────────────────────────────────────────────

class GeneratedReport(BaseModel):
    """Full report returned by POST /generate and GET /{id}."""

    id: int
    user_id: int
    repository: str | None
    pull_request: str | None
    report_type: str
    report_format: str
    report_title: str
    summary: str | None
    report_content: str
    generated_at: str
    payload: ReportPayload | None = None

    @classmethod
    def from_db(cls, row: dict[str, Any], include_payload: bool = True) -> "GeneratedReport":
        import json
        payload: ReportPayload | None = None
        if include_payload:
            raw = row.get("report_content") or "{}"
            # report_content stores the rendered text; payload stored separately
            # For full detail we try to parse it as JSON payload
            try:
                data = json.loads(raw)
                if isinstance(data, dict) and "report_type" in data:
                    payload = ReportPayload(**data)
            except Exception:
                pass
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            repository=row.get("repository"),
            pull_request=row.get("pull_request"),
            report_type=row.get("report_type") or "full",
            report_format=row.get("report_format") or "markdown",
            report_title=row.get("report_title") or "",
            summary=row.get("summary"),
            report_content=row.get("report_content") or "",
            generated_at=row["generated_at"],
            payload=payload,
        )


# ── Response: list item ───────────────────────────────────────────────────────

class ReportListItem(BaseModel):
    """Compact row for the history table — no report_content."""

    id: int
    repository: str | None
    pull_request: str | None
    report_type: str
    report_format: str
    report_title: str
    summary: str | None
    generated_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "ReportListItem":
        return cls(
            id=row["id"],
            repository=row.get("repository"),
            pull_request=row.get("pull_request"),
            report_type=row.get("report_type") or "full",
            report_format=row.get("report_format") or "markdown",
            report_title=row.get("report_title") or "",
            summary=row.get("summary"),
            generated_at=row["generated_at"],
        )


class PaginatedReportList(BaseModel):
    items: list[ReportListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
