"""Pydantic schemas for the AI Test Generator API endpoints."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

# ── Supported options ─────────────────────────────────────────────────────────

SUPPORTED_LANGUAGES = Literal["python", "java", "javascript", "typescript", "go", "csharp"]
SUPPORTED_FRAMEWORKS = Literal["pytest", "unittest", "junit", "jest", "mocha", "nunit"]
SUPPORTED_TEST_TYPES = Literal[
    "unit",
    "integration",
    "api",
    "regression",
    "boundary",
    "edge_cases",
    "negative",
    "performance",
]

LANGUAGE_EXTENSIONS: dict[str, str] = {
    "python": ".py",
    "java": ".java",
    "javascript": ".js",
    "typescript": ".ts",
    "go": "_test.go",
    "csharp": ".cs",
}

LANGUAGE_DISPLAY: dict[str, str] = {
    "python": "Python",
    "java": "Java",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "go": "Go",
    "csharp": "C#",
}

FRAMEWORK_DISPLAY: dict[str, str] = {
    "pytest": "pytest",
    "unittest": "unittest",
    "junit": "JUnit",
    "jest": "Jest",
    "mocha": "Mocha",
    "nunit": "NUnit",
}

TEST_TYPE_DISPLAY: dict[str, str] = {
    "unit": "Unit Tests",
    "integration": "Integration Tests",
    "api": "API Tests",
    "regression": "Regression Tests",
    "boundary": "Boundary Tests",
    "edge_cases": "Edge Cases",
    "negative": "Negative Tests",
    "performance": "Performance Tests",
}


# ── Request ───────────────────────────────────────────────────────────────────

class TestGenerateRequest(BaseModel):
    """Input for POST /api/v1/tests/generate."""

    pr_url: str = Field(..., description="Full GitHub pull-request URL")
    language: SUPPORTED_LANGUAGES = Field("python", description="Target programming language")
    framework: SUPPORTED_FRAMEWORKS = Field("pytest", description="Testing framework")
    test_type: SUPPORTED_TEST_TYPES = Field("unit", description="Type of tests to generate")

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        if "github.com" not in v or "/pull/" not in v:
            raise ValueError("pr_url must be a valid GitHub pull-request URL")
        return v.strip()


# ── Quality analysis sub-model ────────────────────────────────────────────────

class TestQualityAnalysis(BaseModel):
    """AI-estimated quality metrics for the generated test suite."""

    coverage_score: float | None = Field(None, description="Estimated coverage % (0-100)")
    confidence_score: float | None = Field(None, description="AI confidence in output (0-100)")
    risk_level: str | None = Field(None, description="low | medium | high")
    missing_scenarios: list[str] = Field(
        default_factory=list, description="Suggested additional test scenarios"
    )


# ── Response: single generated test ──────────────────────────────────────────

class GeneratedTestResponse(BaseModel):
    """Full detail of a generated test record (returned by generate + get-by-id)."""

    id: int
    user_id: int
    pr_url: str
    language: str
    framework: str
    test_type: str
    generated_code: str
    coverage_score: float | None = None
    confidence_score: float | None = None
    risk_level: str | None = None
    llm_model: str | None = None
    execution_time: float
    created_at: str
    quality: TestQualityAnalysis | None = None

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "GeneratedTestResponse":
        quality = TestQualityAnalysis(
            coverage_score=row.get("coverage_score"),
            confidence_score=row.get("confidence_score"),
            risk_level=row.get("risk_level"),
        )
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            pr_url=row["pr_url"],
            language=row["language"],
            framework=row["framework"],
            test_type=row["test_type"],
            generated_code=row["generated_code"],
            coverage_score=row.get("coverage_score"),
            confidence_score=row.get("confidence_score"),
            risk_level=row.get("risk_level"),
            llm_model=row.get("llm_model"),
            execution_time=row.get("execution_time") or 0.0,
            created_at=row["created_at"],
            quality=quality,
        )


# ── Response: list item (no code body for performance) ───────────────────────

class GeneratedTestListItem(BaseModel):
    """Compact row for the history table — omits generated_code."""

    id: int
    pr_url: str
    language: str
    framework: str
    test_type: str
    coverage_score: float | None = None
    confidence_score: float | None = None
    risk_level: str | None = None
    llm_model: str | None = None
    execution_time: float
    created_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "GeneratedTestListItem":
        return cls(
            id=row["id"],
            pr_url=row["pr_url"],
            language=row["language"],
            framework=row["framework"],
            test_type=row["test_type"],
            coverage_score=row.get("coverage_score"),
            confidence_score=row.get("confidence_score"),
            risk_level=row.get("risk_level"),
            llm_model=row.get("llm_model"),
            execution_time=row.get("execution_time") or 0.0,
            created_at=row["created_at"],
        )


class PaginatedTestList(BaseModel):
    """Paginated test-history response."""

    items: list[GeneratedTestListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
