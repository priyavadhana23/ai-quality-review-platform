"""
Ask router.

POST /api/v1/ask — protected; requires a valid Bearer JWT.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse, SuccessResponse
from app.schemas.review import AskRequest
from app.schemas.user import UserResponse
from app.services.ask_service import AskService

router = APIRouter(prefix="/api/v1", tags=["Ask"])


def _get_ask_service() -> AskService:
    return AskService()


@router.post(
    "/ask",
    response_model=SuccessResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        422: {"model": ErrorResponse, "description": "Invalid PR URL or blank question"},
        502: {"model": ErrorResponse, "description": "AI engine error"},
    },
    summary="Ask a question about a pull request",
    description=(
        "Runs the PR-Agent **ask** tool. "
        "**Requires authentication** — supply `Authorization: Bearer <token>`."
    ),
)
async def ask_pr(
    request: AskRequest,
    service: AskService = Depends(_get_ask_service),
    current_user: UserResponse = Depends(get_current_user),
) -> SuccessResponse:
    """Ask a question about the pull request at *request.pr_url*."""
    return await service.run(
        pr_url=request.pr_url,
        question=request.question,
        user_id=current_user.id,
    )
