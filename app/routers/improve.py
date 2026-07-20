"""
Improve router.

POST /api/v1/improve — protected; requires a valid Bearer JWT.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse, SuccessResponse
from app.schemas.review import ImproveRequest
from app.schemas.user import UserResponse
from app.services.improve_service import ImproveService

router = APIRouter(prefix="/api/v1", tags=["Improve"])


def _get_improve_service() -> ImproveService:
    return ImproveService()


@router.post(
    "/improve",
    response_model=SuccessResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        422: {"model": ErrorResponse, "description": "Invalid PR URL"},
        502: {"model": ErrorResponse, "description": "AI engine error"},
    },
    summary="Suggest code improvements",
    description=(
        "Runs the PR-Agent **improve** tool. "
        "**Requires authentication** — supply `Authorization: Bearer <token>`."
    ),
)
async def improve_pr(
    request: ImproveRequest,
    service: ImproveService = Depends(_get_improve_service),
    current_user: UserResponse = Depends(get_current_user),
) -> SuccessResponse:
    """Generate code improvement suggestions for the pull request at *request.pr_url*."""
    return await service.run(pr_url=request.pr_url, user_id=current_user.id)
