"""
Review router.

POST /api/v1/review — protected; requires a valid Bearer JWT.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse, SuccessResponse
from app.schemas.review import ReviewRequest
from app.schemas.user import UserResponse
from app.services.review_service import ReviewService

router = APIRouter(prefix="/api/v1", tags=["Review"])


def _get_review_service() -> ReviewService:
    return ReviewService()


@router.post(
    "/review",
    response_model=SuccessResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        422: {"model": ErrorResponse, "description": "Invalid PR URL"},
        502: {"model": ErrorResponse, "description": "AI engine error"},
    },
    summary="Review a pull request",
    description=(
        "Runs the PR-Agent **review** tool. "
        "**Requires authentication** — supply `Authorization: Bearer <token>`."
    ),
)
async def review_pr(
    request: ReviewRequest,
    service: ReviewService = Depends(_get_review_service),
    current_user: UserResponse = Depends(get_current_user),
) -> SuccessResponse:
    """Review the pull request at *request.pr_url*."""
    return await service.run(pr_url=request.pr_url, user_id=current_user.id)
