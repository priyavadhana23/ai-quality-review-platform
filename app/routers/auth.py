"""
Authentication router.

Public routes:
  GET  /auth/login        → redirect to GitHub OAuth
  GET  /auth/callback     → receive GitHub code, issue tokens, redirect frontend
  POST /auth/refresh      → rotate refresh token, return new access token
  POST /auth/logout       → revoke refresh token

The callback issues tokens and passes them to the React frontend via
query-string redirect so the SPA can store them in memory / localStorage.
"""
from __future__ import annotations

import secrets

from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse

from app.auth.oauth import build_github_authorize_url
from app.core.config import get_app_settings
from app.core.logger import get_logger
from app.schemas.auth import LogoutRequest, RefreshRequest, TokenResponse
from app.services.auth_service import AuthError, logout, refresh_access_token
from app.services.github_service import github_oauth_login

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get(
    "/login",
    summary="Initiate GitHub OAuth login",
    description="Redirects the browser to GitHub's OAuth authorization page.",
)
async def login() -> RedirectResponse:
    """
    Generate a CSRF state token and redirect the user to GitHub OAuth.
    The state is embedded in the redirect URL; the frontend stores it and
    verifies it when the callback fires.
    """
    state = secrets.token_urlsafe(32)
    authorize_url = build_github_authorize_url(state)
    return RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)


@router.get(
    "/callback",
    summary="GitHub OAuth callback",
    description=(
        "Receives the authorization code from GitHub, completes the OAuth flow, "
        "issues JWT tokens, and redirects the frontend with the access token."
    ),
)
async def callback(
    code: str = Query(..., description="Authorization code from GitHub"),
    state: str = Query(..., description="CSRF state token"),
) -> RedirectResponse:
    """
    Complete the OAuth exchange and redirect the frontend.

    The access_token is passed as a URL fragment (#) so it stays
    client-side and is never sent to any server.
    The refresh_token is passed as a query param so the frontend
    can store it in memory/localStorage for future refresh calls.
    """
    logger = get_logger()
    s = get_app_settings()

    try:
        user, access_token, raw_refresh = await github_oauth_login(code)
    except Exception as exc:
        logger.error(f"GitHub OAuth callback failed: {exc}")
        redirect_url = (
            f"{s.frontend_url}/login?error=oauth_failed"
        )
        return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

    logger.info(f"User '{user.username}' logged in via GitHub OAuth")

    # Pass both tokens to the SPA.  Fragment (#) keeps access token
    # out of server logs; query-param carries refresh token.
    redirect_url = (
        f"{s.frontend_url}/auth/callback"
        f"?refresh_token={raw_refresh}"
        f"#access_token={access_token}"
    )
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    description="Exchange a valid refresh token for a new access token + refresh token pair.",
)
async def refresh(body: RefreshRequest) -> TokenResponse:
    """Rotate the refresh token and return a new access token."""
    try:
        new_access, new_refresh = await refresh_access_token(body.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    return TokenResponse(access_token=new_access, token_type="bearer")


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout",
    description="Revoke the supplied refresh token, ending the session.",
)
async def logout_endpoint(body: LogoutRequest) -> Response:
    """Revoke the refresh token.  Always succeeds (idempotent)."""
    await logout(body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
