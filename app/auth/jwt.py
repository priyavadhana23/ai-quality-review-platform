"""
JWT service — create and validate access + refresh tokens.

Uses PyJWT (already installed) with HS256.
Secrets are loaded from environment variables; never hardcoded.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.core.config import get_app_settings


def _settings():
    return get_app_settings()


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(user_id: int, username: str, role: str) -> str:
    """
    Return a signed JWT access token valid for ``ACCESS_TOKEN_EXPIRE_MINUTES``.

    Payload claims:
      sub  — string user ID
      usr  — GitHub username
      role — user role string
      type — "access"
      iat  — issued-at (UTC)
      exp  — expiry (UTC)
    """
    s = _settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "usr": username,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_expire_minutes),
    }
    return jwt.encode(payload, s.jwt_secret_key, algorithm=s.jwt_algorithm)


def create_refresh_token() -> tuple[str, str, datetime]:
    """
    Return ``(raw_token, hashed_token, expires_at)``.

    The raw token is sent to the client (httpOnly cookie).
    Only the SHA-256 hash is stored in the database.
    ``expires_at`` is the UTC expiry datetime.
    """
    s = _settings()
    raw = secrets.token_urlsafe(48)
    hashed = _hash_token(raw)
    expires_at = datetime.now(UTC) + timedelta(days=s.refresh_token_expire_days)
    return raw, hashed, expires_at


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and verify an access token.

    Raises ``jwt.ExpiredSignatureError`` if expired.
    Raises ``jwt.InvalidTokenError`` for any other invalidity.
    """
    s = _settings()
    payload = jwt.decode(token, s.jwt_secret_key, algorithms=[s.jwt_algorithm])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Token type is not 'access'")
    return payload


def _hash_token(raw: str) -> str:
    """Return the SHA-256 hex digest of a raw token string."""
    return hashlib.sha256(raw.encode()).hexdigest()
