"""
Security middleware bundle.

Provides:
  - Security headers (X-Frame-Options, CSP, HSTS, etc.)
  - Rate limiting via slowapi (graceful no-op if not installed)
  - Environment variable validation on startup
"""
from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

if TYPE_CHECKING:
    from fastapi import FastAPI

_log = logging.getLogger(__name__)


# ── Security headers middleware ───────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next: object) -> Response:
        response: Response = await call_next(request)  # type: ignore[call-arg]
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' wss: https:;",
        )
        if request.url.scheme == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response


# ── Rate limiter setup ────────────────────────────────────────────────────────

def setup_rate_limiter(app: "FastAPI") -> None:
    """Attach slowapi rate limiter to the FastAPI app if available."""
    try:
        from slowapi import Limiter, _rate_limit_exceeded_handler
        from slowapi.errors import RateLimitExceeded
        from slowapi.util import get_remote_address

        limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        _log.info("Rate limiter enabled (200 req/min default)")
    except ImportError:
        _log.info("slowapi not installed — rate limiting disabled")


# ── Environment validation ────────────────────────────────────────────────────

_REQUIRED_PROD_VARS = [
    "APP_JWT_SECRET_KEY",
    "APP_GITHUB_CLIENT_ID",
    "APP_GITHUB_CLIENT_SECRET",
    "APP_REDIS_URL",
]

_INSECURE_DEFAULTS = {
    "APP_JWT_SECRET_KEY": "change-me-in-production-use-a-long-random-secret",
}


def validate_environment() -> list[str]:
    """
    Check that critical environment variables are set and not left at insecure
    defaults.  Returns a list of warnings (non-fatal).

    Performed checks:
      - Required production vars are present
      - JWT secret is not using the insecure default
      - CORS origins is not a wildcard (*) in production — logs a warning
        and, when APP_CORS_STRICT=true, raises RuntimeError to abort startup
    """
    warnings: list[str] = []
    is_prod = os.environ.get("APP_ENV", "development").lower() == "production"

    if is_prod:
        for var in _REQUIRED_PROD_VARS:
            if not os.environ.get(var):
                warnings.append(f"SECURITY: {var} is not set in production")

    for var, bad_value in _INSECURE_DEFAULTS.items():
        if os.environ.get(var) == bad_value:
            warnings.append(f"SECURITY: {var} is using the insecure default value")

    # Wildcard CORS check — dangerous in production because any origin can
    # make credentialed requests against the API.
    cors_origins = os.environ.get("APP_CORS_ORIGINS", "*")
    if is_prod and cors_origins.strip() == "*":
        msg = (
            "SECURITY: APP_CORS_ORIGINS is set to '*' in production. "
            "Set it to your specific frontend domain(s), "
            "e.g. APP_CORS_ORIGINS=https://app.example.com"
        )
        warnings.append(msg)
        strict = os.environ.get("APP_CORS_STRICT", "false").lower() == "true"
        if strict:
            raise RuntimeError(msg)

    for w in warnings:
        _log.warning(w)

    return warnings
