"""Pydantic schemas for the API Quality Analyzer endpoints."""
from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field


# ── Analysis sub-models ───────────────────────────────────────────────────────

class ApiIssue(BaseModel):
    """A single finding — critical, warning, or info."""

    severity: str = Field(description="critical | warning | info")
    category: str = Field(description="security | design | documentation | validation | other")
    title: str
    description: str
    recommendation: str = ""


class EndpointSummary(BaseModel):
    """Brief summary for one API endpoint."""

    method: str
    path: str
    has_auth: bool = False
    has_request_schema: bool = False
    has_response_schema: bool = False
    has_description: bool = False
    issues: list[str] = Field(default_factory=list)


class ApiQualityScores(BaseModel):
    """All quality dimension scores (0-100)."""

    overall: float | None = None
    security: float | None = None
    documentation: float | None = None
    validation: float | None = None
    design: float | None = None
    maintainability: float | None = None


class ApiQualityAnalysis(BaseModel):
    """
    The full structured analysis produced by the AI and stored as JSON
    in the analysis_json column.
    """

    executive_summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    critical_issues: list[ApiIssue] = Field(default_factory=list)
    warnings: list[ApiIssue] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    best_practices: list[str] = Field(default_factory=list)
    scores: ApiQualityScores = Field(default_factory=ApiQualityScores)
    endpoints: list[EndpointSummary] = Field(default_factory=list)


# ── Response: full report ─────────────────────────────────────────────────────

class ApiQualityReport(BaseModel):
    """Full report returned by POST /analyze and GET /{id}."""

    id: int
    user_id: int
    filename: str
    spec_version: str
    api_title: str | None
    api_version: str | None
    total_endpoints: int
    quality_score: float | None
    security_score: float | None
    documentation_score: float | None
    validation_score: float | None
    design_score: float | None
    recommendations: list[str]
    llm_model: str | None
    execution_time: float
    created_at: str
    analysis: ApiQualityAnalysis

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "ApiQualityReport":
        raw = row.get("analysis_json") or "{}"
        try:
            analysis_dict = json.loads(raw)
            analysis = ApiQualityAnalysis(**analysis_dict)
        except Exception:
            analysis = ApiQualityAnalysis()

        raw_recs = row.get("recommendations") or "[]"
        try:
            recs: list[str] = json.loads(raw_recs)
        except Exception:
            recs = []

        return cls(
            id=row["id"],
            user_id=row["user_id"],
            filename=row["filename"],
            spec_version=row.get("spec_version") or "unknown",
            api_title=row.get("api_title"),
            api_version=row.get("api_version"),
            total_endpoints=row.get("total_endpoints") or 0,
            quality_score=row.get("quality_score"),
            security_score=row.get("security_score"),
            documentation_score=row.get("documentation_score"),
            validation_score=row.get("validation_score"),
            design_score=row.get("design_score"),
            recommendations=recs,
            llm_model=row.get("llm_model"),
            execution_time=row.get("execution_time") or 0.0,
            created_at=row["created_at"],
            analysis=analysis,
        )


# ── Response: list item ───────────────────────────────────────────────────────

class ApiQualityListItem(BaseModel):
    """Compact row for the history table — omits analysis_json."""

    id: int
    filename: str
    spec_version: str
    api_title: str | None
    api_version: str | None
    total_endpoints: int
    quality_score: float | None
    security_score: float | None
    documentation_score: float | None
    validation_score: float | None
    design_score: float | None
    llm_model: str | None
    execution_time: float
    created_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "ApiQualityListItem":
        return cls(
            id=row["id"],
            filename=row["filename"],
            spec_version=row.get("spec_version") or "unknown",
            api_title=row.get("api_title"),
            api_version=row.get("api_version"),
            total_endpoints=row.get("total_endpoints") or 0,
            quality_score=row.get("quality_score"),
            security_score=row.get("security_score"),
            documentation_score=row.get("documentation_score"),
            validation_score=row.get("validation_score"),
            design_score=row.get("design_score"),
            llm_model=row.get("llm_model"),
            execution_time=row.get("execution_time") or 0.0,
            created_at=row["created_at"],
        )


class PaginatedReportList(BaseModel):
    """Paginated history response."""

    items: list[ApiQualityListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
