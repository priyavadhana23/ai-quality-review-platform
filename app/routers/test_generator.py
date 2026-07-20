"""
AI Test Generator router.

All endpoints require a valid Bearer JWT.  Every query is scoped to
current_user.id — users cannot access each other's generated tests.

Routes
------
POST   /api/v1/tests/generate     — generate tests for a PR
GET    /api/v1/tests/history      — paginated list of past generations
GET    /api/v1/tests/{test_id}    — full detail including code
DELETE /api/v1/tests/{test_id}    — delete a generated test record
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse
from app.schemas.test_generator import (
    GeneratedTestResponse,
    PaginatedTestList,
    TestGenerateRequest,
)
from app.schemas.user import UserResponse
from app.services import test_generator_service

router = APIRouter(prefix="/api/v1/tests", tags=["Test Generator"])


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=GeneratedTestResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        422: {"model": ErrorResponse, "description": "Invalid request body"},
        502: {"model": ErrorResponse, "description": "AI engine error"},
    },
    summary="Generate tests for a pull request",
    description=(
        "Analyses the PR diff and generates production-quality tests using the "
        "existing Gemini/LiteLLM pipeline. Persists the result automatically. "
        "**Requires authentication.**"
    ),
)
async def generate_tests(
    request: TestGenerateRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> GeneratedTestResponse:
    """Generate and persist tests for the given PR."""
    return await test_generator_service.generate_tests(
        user_id=current_user.id,
        pr_url=request.pr_url,
        language=request.language,
        framework=request.framework,
        test_type=request.test_type,
    )


# ── History ───────────────────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=PaginatedTestList,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
    },
    summary="List generated-test history",
    description=(
        "Returns a paginated list of previously generated tests for the "
        "authenticated user. Supports filtering by language and framework. "
        "**Requires authentication.**"
    ),
)
async def list_tests(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    language: str | None = Query(None, description="Filter by language"),
    framework: str | None = Query(None, description="Filter by framework"),
    current_user: UserResponse = Depends(get_current_user),
) -> PaginatedTestList:
    """Return paginated test history for the authenticated user."""
    return await test_generator_service.list_tests(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        language=language,
        framework=framework,
    )


# ── Get by ID ─────────────────────────────────────────────────────────────────

@router.get(
    "/{test_id}",
    response_model=GeneratedTestResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        404: {"model": ErrorResponse, "description": "Test not found or not owned by user"},
    },
    summary="Get a generated test by ID",
    description=(
        "Returns the full generated-test record including the complete code. "
        "Returns 404 if the record does not exist or belongs to a different user. "
        "**Requires authentication.**"
    ),
)
async def get_test(
    test_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> GeneratedTestResponse:
    """Return a single generated-test record if owned by the authenticated user."""
    test = await test_generator_service.get_test(test_id, current_user.id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Generated test {test_id} not found",
        )
    return test


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete(
    "/{test_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        404: {"model": ErrorResponse, "description": "Test not found or not owned by user"},
    },
    summary="Delete a generated test",
    description=(
        "Permanently deletes a generated-test record that belongs to the "
        "authenticated user. **Requires authentication.**"
    ),
)
async def delete_test(
    test_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> None:
    """Delete a generated test if owned by the authenticated user."""
    deleted = await test_generator_service.delete_test(test_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Generated test {test_id} not found",
        )
