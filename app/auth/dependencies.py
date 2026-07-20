"""
FastAPI dependency — ``get_current_user``.

Inject this into any route to require a valid JWT access token:

    @router.get("/protected")
    async def protected(user: UserResponse = Depends(get_current_user)):
        ...

The token is read from the ``Authorization: Bearer <token>`` header.
"""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import decode_access_token
from app.db.user_repository import UserRepository
from app.schemas.user import UserResponse

_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> UserResponse:
    """
    Validate the Bearer JWT and return the authenticated user.

    Raises HTTP 401 for missing/invalid tokens and HTTP 403 if the user
    record no longer exists in the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_exception

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    user_row = await UserRepository.get_by_id(int(user_id_str))
    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account not found",
        )

    return UserResponse.from_db(user_row)
