"""
Pydantic request schemas for all four PR-Agent tool endpoints.

Each schema is intentionally minimal — the PR URL is the only required
field.  Extra configuration is handled by PR-Agent's own settings layer,
not duplicated here.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


# ── Shared URL validator ──────────────────────────────────────────────────────

def _validate_pr_url(url: str) -> str:
    """Reject obviously malformed PR URLs before sending them to the engine."""
    url = url.strip()
    if not url.startswith(("https://", "http://")):
        raise ValueError("pr_url must start with http:// or https://")
    if len(url) < 20:
        raise ValueError("pr_url is too short to be a valid pull-request URL")
    return url


# ── Request models ────────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    """Request body for POST /api/v1/review."""

    pr_url: str = Field(
        ...,
        description="Full URL of the GitHub / GitLab pull request",
        examples=["https://github.com/owner/repo/pull/42"],
    )

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        return _validate_pr_url(v)

    model_config = {"json_schema_extra": {
        "example": {"pr_url": "https://github.com/owner/repo/pull/42"}
    }}


class DescribeRequest(BaseModel):
    """Request body for POST /api/v1/describe."""

    pr_url: str = Field(
        ...,
        description="Full URL of the GitHub / GitLab pull request",
        examples=["https://github.com/owner/repo/pull/42"],
    )

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        return _validate_pr_url(v)

    model_config = {"json_schema_extra": {
        "example": {"pr_url": "https://github.com/owner/repo/pull/42"}
    }}


class ImproveRequest(BaseModel):
    """Request body for POST /api/v1/improve."""

    pr_url: str = Field(
        ...,
        description="Full URL of the GitHub / GitLab pull request",
        examples=["https://github.com/owner/repo/pull/42"],
    )

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        return _validate_pr_url(v)

    model_config = {"json_schema_extra": {
        "example": {"pr_url": "https://github.com/owner/repo/pull/42"}
    }}


class AskRequest(BaseModel):
    """Request body for POST /api/v1/ask."""

    pr_url: str = Field(
        ...,
        description="Full URL of the GitHub / GitLab pull request",
        examples=["https://github.com/owner/repo/pull/42"],
    )
    question: str = Field(
        ...,
        min_length=3,
        description="Natural-language question about the pull request",
        examples=["Explain the security implications of this change"],
    )

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        return _validate_pr_url(v)

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("question must not be blank")
        return v

    model_config = {"json_schema_extra": {
        "example": {
            "pr_url": "https://github.com/owner/repo/pull/42",
            "question": "Explain the security implications of this change",
        }
    }}
