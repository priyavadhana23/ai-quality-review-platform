"""Pydantic schemas for authentication request/response bodies."""
from __future__ import annotations

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    """Returned after successful login or token refresh."""

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Always 'bearer'")

    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }
    }


class RefreshRequest(BaseModel):
    """Body for POST /auth/refresh."""

    refresh_token: str = Field(..., description="Opaque refresh token")


class LogoutRequest(BaseModel):
    """Body for POST /auth/logout."""

    refresh_token: str = Field(..., description="Refresh token to revoke")


class GitHubCallbackParams(BaseModel):
    """Query parameters received on the OAuth callback."""

    code: str = Field(..., description="Temporary authorization code from GitHub")
    state: str = Field(..., description="CSRF state token")
