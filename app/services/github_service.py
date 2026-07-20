"""
GitHub OAuth service.

Orchestrates the OAuth code-exchange → user-fetch → upsert pipeline.
Returns a ``UserResponse`` and the token pair needed for the session.
"""
from __future__ import annotations

from app.auth.jwt import create_access_token, create_refresh_token
from app.auth.oauth import exchange_code_for_token, fetch_github_user
from app.db.user_repository import RefreshTokenRepository, UserRepository
from app.schemas.user import UserResponse


async def github_oauth_login(code: str) -> tuple[UserResponse, str, str]:
    """
    Complete the GitHub OAuth flow.

    Steps:
      1. Exchange the authorization ``code`` for a GitHub access token.
      2. Fetch the authenticated GitHub user profile.
      3. Upsert the user in the local database.
      4. Issue a JWT access token and a refresh token.

    Returns:
        ``(user, access_token, raw_refresh_token)``
    """
    # 1 — Exchange code for GitHub access token
    gh_token = await exchange_code_for_token(code)

    # 2 — Fetch the GitHub user profile
    gh_user = await fetch_github_user(gh_token)

    # 3 — Upsert user in local DB
    db_row = await UserRepository.upsert(
        github_id=int(gh_user["id"]),
        username=gh_user["login"],
        email=gh_user.get("email"),
        avatar_url=gh_user.get("avatar_url"),
    )
    user = UserResponse.from_db(db_row)

    # 4 — Issue tokens
    access_token = create_access_token(user.id, user.username, user.role)
    raw_refresh, hashed_refresh, expires_at = create_refresh_token()
    await RefreshTokenRepository.save(
        user_id=user.id,
        token_hash=hashed_refresh,
        expires_at=expires_at.isoformat(),
    )

    return user, access_token, raw_refresh
