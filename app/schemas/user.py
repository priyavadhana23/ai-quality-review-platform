"""Pydantic schemas for user profile responses."""
from __future__ import annotations

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    """Public user profile — safe to send to the client."""

    id: int = Field(..., description="Internal user ID")
    github_id: int = Field(..., description="GitHub user ID")
    username: str = Field(..., description="GitHub login / username")
    email: str | None = Field(None, description="Primary GitHub email (may be null)")
    avatar_url: str | None = Field(None, description="GitHub avatar URL")
    role: str = Field(..., description="User role: 'user' or 'admin'")
    created_at: str = Field(..., description="Account creation timestamp (ISO-8601)")
    last_login: str = Field(..., description="Last login timestamp (ISO-8601)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": 1,
                "github_id": 583231,
                "username": "octocat",
                "email": "octocat@github.com",
                "avatar_url": "https://avatars.githubusercontent.com/u/583231",
                "role": "user",
                "created_at": "2024-01-01T00:00:00",
                "last_login": "2024-07-19T12:00:00",
            }
        }
    }

    @classmethod
    def from_db(cls, row: dict) -> "UserResponse":
        """Construct from a raw database row dict."""
        return cls(**row)
