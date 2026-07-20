"""
GitHub OAuth 2.0 helpers.

Builds the authorization URL and exchanges the callback code for a GitHub
access token, then fetches the authenticated user's profile.

All secrets come from environment variables via ``get_app_settings()``.
No GitHub token is ever logged or stored in plaintext beyond the request lifetime.
"""
from __future__ import annotations

import httpx

from app.core.config import get_app_settings
from app.core.logger import get_logger

_GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
_GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
_GITHUB_API_BASE = "https://api.github.com"
_GITHUB_SCOPES = "read:user user:email"


def build_github_authorize_url(state: str) -> str:
    """
    Return the GitHub OAuth authorization URL.

    The ``state`` parameter is a CSRF-prevention token that the client
    generates, stores (e.g. in sessionStorage), and verifies on callback.
    """
    s = get_app_settings()
    params = (
        f"client_id={s.github_client_id}"
        f"&redirect_uri={s.github_callback_url}"
        f"&scope={_GITHUB_SCOPES.replace(' ', '%20')}"
        f"&state={state}"
    )
    return f"{_GITHUB_AUTHORIZE_URL}?{params}"


async def exchange_code_for_token(code: str) -> str:
    """
    Exchange the OAuth callback ``code`` for a GitHub access token.

    Raises ``ValueError`` if GitHub returns an error.
    """
    s = get_app_settings()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _GITHUB_TOKEN_URL,
            json={
                "client_id": s.github_client_id,
                "client_secret": s.github_client_secret,
                "code": code,
                "redirect_uri": s.github_callback_url,
            },
            headers={"Accept": "application/json"},
        )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise ValueError(f"GitHub OAuth error: {data['error_description']}")
    return data["access_token"]


async def fetch_github_user(access_token: str) -> dict:
    """
    Return the authenticated GitHub user's profile dict.

    Fields used downstream: ``id``, ``login``, ``email``, ``avatar_url``.
    If the user's email is not public, a separate /user/emails call is made.
    """
    logger = get_logger()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        # Primary profile
        r_user = await client.get(f"{_GITHUB_API_BASE}/user", headers=headers)
        r_user.raise_for_status()
        profile = r_user.json()

        # Fetch primary email if the public profile has none
        if not profile.get("email"):
            try:
                r_emails = await client.get(
                    f"{_GITHUB_API_BASE}/user/emails", headers=headers
                )
                if r_emails.status_code == 200:
                    emails = r_emails.json()
                    primary = next(
                        (e["email"] for e in emails if e.get("primary") and e.get("verified")),
                        None,
                    )
                    profile["email"] = primary
            except Exception as exc:
                logger.warning(f"Could not fetch GitHub emails: {exc}")

    return profile
