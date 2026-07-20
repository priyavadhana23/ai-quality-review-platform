"""
Shared Pydantic models used across multiple API endpoints.

All response envelopes follow the same structure so clients can handle
success/error uniformly without inspecting HTTP status codes.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class SuccessResponse(BaseModel):
    """Envelope returned on a successful tool execution."""

    status: Literal["success"] = "success"
    tool: str = Field(..., description="Name of the PR-Agent tool that was executed")
    execution_time: float = Field(..., description="Wall-clock time in seconds")
    data: Any = Field(..., description="Tool output — structure varies per tool")

    model_config = {"json_schema_extra": {
        "example": {
            "status": "success",
            "tool": "review",
            "execution_time": 3.14,
            "data": {"review": "## PR Reviewer Guide 🔍\n\n..."},
        }
    }}


class ErrorResponse(BaseModel):
    """Envelope returned when an error occurs."""

    status: Literal["error"] = "error"
    message: str = Field(..., description="Human-readable error description")

    model_config = {"json_schema_extra": {
        "example": {
            "status": "error",
            "message": "Invalid or unreachable PR URL: 'https://github.com/org/repo/pull/999'",
        }
    }}


class ComponentHealth(BaseModel):
    """Health status of a single dependency."""

    status: Literal["ok", "degraded", "unavailable"]
    detail: str | None = None


class HealthResponse(BaseModel):
    """Response for the health check endpoint."""

    status: Literal["ok", "degraded"] = "ok"
    version: str = Field(..., description="API version string")
    engine: str = Field(default="PR-Agent v0.39.0", description="Underlying engine version")
    components: dict[str, ComponentHealth] = Field(
        default_factory=dict,
        description="Per-component health (database, redis, celery, websocket)",
    )
