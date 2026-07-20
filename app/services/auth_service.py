"""
Auth service — token refresh and logout operations.
"""
from __future__ import annotations

from app.auth.jwt import create_access_token, create_refresh_token, _hash_token
from app.core.exceptions import PRAgentAPIError
from app.db.user_repository import RefreshTokenRepository, UserRepository


class AuthError(PRAgentAPIError):
    """Raised when authentication or token operations fail."""

    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=401)


async def refresh_access_token(raw_refresh_token: str) -> tuple[str, str]:
    """
    Validate the refresh token, rotate it, and return a new token pair.

    Implements refresh token rotation: the old token is revoked and a new
    one is issued on every call.

    Returns:
        ``(new_access_token, new_raw_refresh_token)``

    Raises:
        ``AuthError`` if the token is invalid, expired, or revoked.
    """
    token_hash = _hash_token(raw_refresh_token)
    token_row = await RefreshTokenRepository.get_valid(token_hash)
    if not token_row:
        raise AuthError("Refresh token is invalid or expired")

    user_id = token_row["user_id"]
    user_row = await UserRepository.get_by_id(user_id)
    if not user_row:
        raise AuthError("User not found")

    # Rotate — revoke old, issue new
    await RefreshTokenRepository.revoke(token_hash)
    new_access = create_access_token(user_row["id"], user_row["username"], user_row["role"])
    new_raw_refresh, new_hash, expires_at = create_refresh_token()
    await RefreshTokenRepository.save(
        user_id=user_id,
        token_hash=new_hash,
        expires_at=expires_at.isoformat(),
    )

    await UserRepository.update_last_login(user_id)
    return new_access, new_raw_refresh


async def logout(raw_refresh_token: str) -> None:
    """Revoke the provided refresh token.  Silent if already revoked."""
    token_hash = _hash_token(raw_refresh_token)
    await RefreshTokenRepository.revoke(token_hash)


async def logout_all(user_id: int) -> None:
    """Revoke every refresh token for a user (logout from all devices)."""
    await RefreshTokenRepository.revoke_all_for_user(user_id)
