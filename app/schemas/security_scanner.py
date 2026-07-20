"""Pydantic schemas for the AI Security Scanner API endpoints."""
from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ── Severity / category constants ─────────────────────────────────────────────

SEVERITY_LEVELS = ("critical", "high", "medium", "low")
OWASP_CATEGORIES = (
    "A01:2021-Broken Access Control",
    "A02:2021-Cryptographic Failures",
    "A03:2021-Injection",
    "A04:2021-Insecure Design",
    "A05:2021-Security Misconfiguration",
    "A06:2021-Vulnerable and Outdated Components",
    "A07:2021-Identification and Authentication Failures",
    "A08:2021-Software and Data Integrity Failures",
    "A09:2021-Security Logging and Monitoring Failures",
    "A10:2021-Server-Side Request Forgery",
)

SCAN_TYPES = ("pr", "zip", "repository")


# ── Request ───────────────────────────────────────────────────────────────────

class SecurityScanRequest(BaseModel):
    """Input for POST /api/v1/security/analyze when scanning a PR URL."""

    pr_url: str = Field(..., description="Full GitHub pull-request URL")
    scan_type: str = Field("pr", description="Scan type: pr | repository")

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        v = v.strip()
        if "github.com" not in v or "/pull/" not in v:
            raise ValueError("pr_url must be a valid GitHub pull-request URL")
        return v

    @field_validator("scan_type")
    @classmethod
    def validate_scan_type(cls, v: str) -> str:
        if v not in SCAN_TYPES:
            raise ValueError(f"scan_type must be one of: {', '.join(SCAN_TYPES)}")
        return v


# ── Analysis sub-models ───────────────────────────────────────────────────────

class SecurityFinding(BaseModel):
    """A single security finding from the AI analysis."""

    severity: str = Field(description="critical | high | medium | low")
    owasp_category: str = Field(default="", description="OWASP Top 10 category")
    cwe_id: str = Field(default="", description="CWE identifier e.g. CWE-89")
    title: str = Field(default="")
    description: str = Field(default="")
    affected_file: str = Field(default="")
    affected_function: str = Field(default="")
    confidence: float = Field(default=0.0, description="0-100 confidence score")
    risk_explanation: str = Field(default="")
    recommendation: str = Field(default="")
    secure_code_example: str = Field(default="")


class RiskDistribution(BaseModel):
    """Count of findings per severity level."""

    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class SecurityChecklistItem(BaseModel):
    """A single item in the secure coding checklist."""

    category: str = Field(default="")
    item: str = Field(default="")
    status: str = Field(default="check", description="check | warning | fail")


class SecurityAnalysis(BaseModel):
    """
    The full structured analysis stored as JSON in scan_report_json.
    """

    executive_summary: str = ""
    overall_security_score: float | None = None
    risk_distribution: RiskDistribution = Field(default_factory=RiskDistribution)
    findings: list[SecurityFinding] = Field(default_factory=list)
    top_risks: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    owasp_categories_found: list[str] = Field(default_factory=list)
    cwe_ids_found: list[str] = Field(default_factory=list)
    secure_coding_checklist: list[SecurityChecklistItem] = Field(default_factory=list)


# ── Response: full scan report ────────────────────────────────────────────────

class SecurityScanReport(BaseModel):
    """Full report returned by POST /analyze and GET /{id}."""

    id: int
    user_id: int
    review_id: int | None
    repository: str | None
    branch: str | None
    commit_sha: str | None
    scan_type: str
    overall_security_score: float | None
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    owasp_categories: list[str]
    cwe_categories: list[str]
    executive_summary: str | None
    recommendations: list[str]
    llm_model: str | None
    execution_time: float
    created_at: str
    analysis: SecurityAnalysis

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "SecurityScanReport":
        raw = row.get("scan_report_json") or "{}"
        try:
            analysis = SecurityAnalysis(**json.loads(raw))
        except Exception:
            analysis = SecurityAnalysis()

        def _json_list(key: str) -> list[str]:
            try:
                return json.loads(row.get(key) or "[]")
            except Exception:
                return []

        return cls(
            id=row["id"],
            user_id=row["user_id"],
            review_id=row.get("review_id"),
            repository=row.get("repository"),
            branch=row.get("branch"),
            commit_sha=row.get("commit_sha"),
            scan_type=row.get("scan_type") or "pr",
            overall_security_score=row.get("overall_security_score"),
            critical_count=row.get("critical_count") or 0,
            high_count=row.get("high_count") or 0,
            medium_count=row.get("medium_count") or 0,
            low_count=row.get("low_count") or 0,
            owasp_categories=_json_list("owasp_categories"),
            cwe_categories=_json_list("cwe_categories"),
            executive_summary=row.get("executive_summary"),
            recommendations=_json_list("recommendations"),
            llm_model=row.get("llm_model"),
            execution_time=row.get("execution_time") or 0.0,
            created_at=row["created_at"],
            analysis=analysis,
        )


# ── Response: list item (no scan_report_json) ─────────────────────────────────

class SecurityScanListItem(BaseModel):
    """Compact row for the history table."""

    id: int
    repository: str | None
    branch: str | None
    scan_type: str
    overall_security_score: float | None
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    llm_model: str | None
    execution_time: float
    created_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "SecurityScanListItem":
        return cls(
            id=row["id"],
            repository=row.get("repository"),
            branch=row.get("branch"),
            scan_type=row.get("scan_type") or "pr",
            overall_security_score=row.get("overall_security_score"),
            critical_count=row.get("critical_count") or 0,
            high_count=row.get("high_count") or 0,
            medium_count=row.get("medium_count") or 0,
            low_count=row.get("low_count") or 0,
            llm_model=row.get("llm_model"),
            execution_time=row.get("execution_time") or 0.0,
            created_at=row["created_at"],
        )


class PaginatedScanList(BaseModel):
    """Paginated scan-history response."""

    items: list[SecurityScanListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
