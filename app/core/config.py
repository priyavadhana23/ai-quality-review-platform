"""
Application configuration.

All settings are read from environment variables with safe defaults.
PR-Agent's own Dynaconf settings (pr_agent/config_loader.py) remain
untouched; this module only governs the API server itself.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """FastAPI server settings — sourced from environment variables."""

    # ── Server ───────────────────────────────────────────────────────────────
    app_title: str = Field(default="AI Quality Review Platform", description="OpenAPI title")
    app_description: str = Field(
        default=(
            "Production-grade REST API that exposes PR-Agent review capabilities "
            "(review, describe, improve, ask) as JSON endpoints."
        ),
        description="OpenAPI description",
    )
    app_version: str = Field(default="1.0.0", description="API version")
    host: str = Field(default="0.0.0.0", description="Bind host")
    port: int = Field(default=8000, description="Bind port")
    reload: bool = Field(default=False, description="Enable uvicorn hot-reload (dev only)")

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins.  Use "*" in development only.
    cors_origins: str = Field(
        default="*",
        description="Comma-separated allowed CORS origins",
    )

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = Field(default="INFO", description="Log level (DEBUG/INFO/WARNING/ERROR)")

    # ── Request behaviour ─────────────────────────────────────────────────────
    # Maximum seconds the API will wait for a PR-Agent operation to complete.
    request_timeout_seconds: int = Field(
        default=300,
        description="Hard timeout (seconds) for AI operations",
    )

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt_secret_key: str = Field(
        default="change-me-in-production-use-a-long-random-secret",
        description="HMAC signing secret for JWT tokens.  Set APP_JWT_SECRET_KEY in env.",
    )
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    access_token_expire_minutes: int = Field(
        default=60, description="Access token lifetime in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=30, description="Refresh token lifetime in days"
    )

    # ── GitHub OAuth ──────────────────────────────────────────────────────────
    github_client_id: str = Field(
        default="",
        description="GitHub OAuth App client ID.  Set APP_GITHUB_CLIENT_ID in env.",
    )
    github_client_secret: str = Field(
        default="",
        description="GitHub OAuth App client secret.  Set APP_GITHUB_CLIENT_SECRET in env.",
    )
    github_callback_url: str = Field(
        default="http://localhost:8000/auth/callback",
        description="Absolute callback URL registered in the GitHub OAuth App.",
    )

    # ── Frontend URL (used for redirect after OAuth) ──────────────────────────
    frontend_url: str = Field(
        default="http://localhost:5173",
        description="Base URL of the React frontend, used to build post-login redirects.",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a Python list."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_prefix": "APP_", "case_sensitive": False}


@lru_cache(maxsize=1)
def get_app_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()
