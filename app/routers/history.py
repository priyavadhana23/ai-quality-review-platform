"""
History router.

All endpoints require a valid Bearer JWT (Depends(get_current_user)).
Every query is scoped to current_user.id — users cannot access each
other's data (IDOR prevention).

List results are served from Redis cache (TTL 60 s).
Cache is invalidated on delete and on new review creation.

Routes
------
GET    /api/v1/history                   — paginated review list (cached 60 s)
GET    /api/v1/history/{review_id}       — full review detail
DELETE /api/v1/history/{review_id}       — delete a review (invalidates cache)
GET    /api/v1/repositories              — list analysed repos for the user
GET    /api/v1/pullrequests              — list pull requests for the user
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.cache.cache_layer import invalidate_history_cache, list_reviews_cached
from app.schemas.common import ErrorResponse
from app.schemas.history import (
    PaginatedReviewList,
    PullRequestResponse,
    RepositoryResponse,
    ReviewDetail,
)
from app.schemas.user import UserResponse
from app.services import history_service

router = APIRouter(prefix="/api/v1", tags=["History"])


# ── List reviews (paginated, filtered, searched) ──────────────────────────────

@router.get(
    "/history",
    response_model=PaginatedReviewList,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
    },
    summary="List review history",
    description=(
        "Returns a paginated list of the authenticated user's reviews. "
        "Supports server-side filtering by tool and repository, full-text "
        "search, and sort order. Cached 60 s per unique filter combination. "
        "**Requires authentication.**"
    ),
)
async def list_history(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    tool: str | None = Query(None, description="Filter by tool name (review/describe/improve/ask)"),
    repo: str | None = Query(None, description="Filter by owner, repo, or owner/repo"),
    search: str | None = Query(None, description="Free-text search across PR URL and content"),
    sort: str = Query("newest", description="Sort order: newest or oldest"),
    current_user: UserResponse = Depends(get_current_user),
) -> PaginatedReviewList:
    """Return paginated history for the authenticated user (cache-backed)."""
    return await list_reviews_cached(
        user_id=current_user.id,
        tool_filter=tool,
        repo_filter=repo,
        search=search,
        page=page,
        page_size=page_size,
        sort=sort,
    )


# ── Get single review detail ──────────────────────────────────────────────────

@router.get(
    "/history/{review_id}",
    response_model=ReviewDetail,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        404: {"model": ErrorResponse, "description": "Review not found or not owned by user"},
    },
    summary="Get a review by ID",
    description=(
        "Returns the full review detail — including the complete markdown — for "
        "the given ID. Returns 404 if the review does not exist or belongs to a "
        "different user. **Requires authentication.**"
    ),
)
async def get_review(
    review_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> ReviewDetail:
    """Return a single review if it belongs to the authenticated user."""
    review = await history_service.get_review(review_id, current_user.id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review {review_id} not found",
        )
    return review


# ── Delete a review ───────────────────────────────────────────────────────────

@router.delete(
    "/history/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        404: {"model": ErrorResponse, "description": "Review not found or not owned by user"},
    },
    summary="Delete a review",
    description=(
        "Permanently deletes a review that belongs to the authenticated user. "
        "Invalidates the history list cache for this user. "
        "Returns 404 if the review does not exist or belongs to a different user. "
        "**Requires authentication.**"
    ),
)
async def delete_review(
    review_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> None:
    """Delete a review and invalidate the user's history cache."""
    deleted = await history_service.delete_review(review_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review {review_id} not found",
        )
    # Invalidate cached list so the deleted item is not served stale
    await invalidate_history_cache(current_user.id)


# ── List repositories ─────────────────────────────────────────────────────────

@router.get(
    "/repositories",
    response_model=list[RepositoryResponse],
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
    },
    summary="List analysed repositories",
    description=(
        "Returns all GitHub repositories that the authenticated user has "
        "previously analysed. Used to populate filter drop-downs. "
        "**Requires authentication.**"
    ),
)
async def list_repositories(
    current_user: UserResponse = Depends(get_current_user),
) -> list[RepositoryResponse]:
    """Return all repositories for the authenticated user."""
    return await history_service.list_repositories(current_user.id)


# ── List pull requests ────────────────────────────────────────────────────────

@router.get(
    "/pullrequests",
    response_model=list[PullRequestResponse],
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
    },
    summary="List analysed pull requests",
    description=(
        "Returns all pull requests belonging to the authenticated user's "
        "repositories. **Requires authentication.**"
    ),
)
async def list_pull_requests(
    current_user: UserResponse = Depends(get_current_user),
) -> list[PullRequestResponse]:
    """Return all pull requests for the authenticated user."""
    return await history_service.list_pull_requests(current_user.id)
