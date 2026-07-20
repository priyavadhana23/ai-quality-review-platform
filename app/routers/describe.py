"""
Describe router.

POST /api/v1/describe — protected; requires a valid Bearer JWT.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse, SuccessResponse
from app.schemas.review import DescribeRequest
from app.schemas.user import UserResponse
from app.services.describe_service import DescribeService

router = APIRouter(prefix="/api/v1", tags=["Describe"])


def _get_describe_service() -> DescribeService:
    return DescribeService()


@router.post(
    "/describe",
    response_model=SuccessResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        422: {"model": ErrorResponse, "description": "Invalid PR URL"},
        502: {"model": ErrorResponse, "description": "AI engine error"},
    },
    summary="Generate a PR description",
    description=(
        "Runs the PR-Agent **describe** tool. "
        "**Requires authentication** — supply `Authorization: Bearer <token>`."
    ),
)
async def describe_pr(
    request: DescribeRequest,
    service: DescribeService = Depends(_get_describe_service),
    current_user: UserResponse = Depends(get_current_user),
) -> SuccessResponse:
    """Generate a description for the pull request at *request.pr_url*."""
    return await service.run(pr_url=request.pr_url, user_id=current_user.id)
