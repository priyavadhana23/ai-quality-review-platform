"""
Celery task status router.

GET /api/v1/tasks/{task_id}        — poll a background task by Celery task ID
POST /api/v1/tasks/review          — submit a review to the background queue
POST /api/v1/tasks/security-scan   — submit a security scan to the background queue
POST /api/v1/tasks/test-generate   — submit test generation to the background queue
POST /api/v1/tasks/report-generate — submit report generation to the background queue

All submission endpoints return immediately with a task_id that the client
can poll.  They do NOT replace the synchronous endpoints — they are additive.

Requires authentication on every route.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/api/v1/tasks", tags=["Background Tasks"])


# ── Response schemas ──────────────────────────────────────────────────────────

class TaskSubmitted(BaseModel):
    task_id: str
    status: str = "submitted"
    message: str = "Task queued — poll /api/v1/tasks/{task_id} for status"


class TaskStatus(BaseModel):
    task_id: str
    status: str        # PENDING | STARTED | SUCCESS | FAILURE | RETRY
    result: Any = None
    error: str | None = None


# ── Request schemas ───────────────────────────────────────────────────────────

class ReviewTaskRequest(BaseModel):
    pr_url: str = Field(..., description="GitHub pull-request URL")
    tool: str = Field("review", description="Tool: review | describe | improve | ask")


class SecurityScanRequest(BaseModel):
    pr_url: str = Field(..., description="GitHub pull-request URL")


class TestGenerateRequest(BaseModel):
    pr_url: str
    language: str = "python"
    framework: str = "pytest"
    test_type: str = "unit"


class ReportGenerateRequest(BaseModel):
    report_type: str = "full"
    report_format: str = "markdown"
    report_title: str = ""
    repository: str | None = None


# ── Helper: get Celery app or raise 503 ──────────────────────────────────────

def _get_celery():  # type: ignore[return]
    try:
        from app.workers.celery_app import app as celery_app
        return celery_app
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Background worker not available",
        )


# ── Status poll ───────────────────────────────────────────────────────────────

@router.get(
    "/{task_id}",
    response_model=TaskStatus,
    responses={
        401: {"model": ErrorResponse},
        503: {"model": ErrorResponse, "description": "Celery not available"},
    },
    summary="Poll background task status",
    description=(
        "Returns the current status of a queued background task. "
        "Status values: PENDING | STARTED | SUCCESS | FAILURE | RETRY. "
        "**Requires authentication.**"
    ),
)
async def get_task_status(
    task_id: str,
    _current_user: UserResponse = Depends(get_current_user),
) -> TaskStatus:
    celery_app = _get_celery()
    result = celery_app.AsyncResult(task_id)
    error: str | None = None
    task_result: Any = None

    if result.state == "SUCCESS":
        task_result = result.result
    elif result.state == "FAILURE":
        error = str(result.result)

    return TaskStatus(
        task_id=task_id,
        status=result.state,
        result=task_result,
        error=error,
    )


# ── Submit review ─────────────────────────────────────────────────────────────

@router.post(
    "/review",
    response_model=TaskSubmitted,
    status_code=status.HTTP_202_ACCEPTED,
    responses={401: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Queue AI review in background",
    description=(
        "Submits a PR review to the Celery worker queue. "
        "Returns immediately with a task_id. "
        "**Requires authentication.**"
    ),
)
async def submit_review(
    req: ReviewTaskRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> TaskSubmitted:
    _get_celery()
    from app.workers.celery_app import run_review
    task = run_review.delay(
        user_id=current_user.id,
        pr_url=req.pr_url,
        tool=req.tool,
    )
    return TaskSubmitted(task_id=task.id)


# ── Submit security scan ──────────────────────────────────────────────────────

@router.post(
    "/security-scan",
    response_model=TaskSubmitted,
    status_code=status.HTTP_202_ACCEPTED,
    responses={401: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Queue security scan in background",
    description="**Requires authentication.**",
)
async def submit_security_scan(
    req: SecurityScanRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> TaskSubmitted:
    _get_celery()
    from app.workers.celery_app import run_security_scan
    task = run_security_scan.delay(
        user_id=current_user.id,
        pr_url=req.pr_url,
    )
    return TaskSubmitted(task_id=task.id)


# ── Submit test generation ────────────────────────────────────────────────────

@router.post(
    "/test-generate",
    response_model=TaskSubmitted,
    status_code=status.HTTP_202_ACCEPTED,
    responses={401: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Queue test generation in background",
    description="**Requires authentication.**",
)
async def submit_test_generation(
    req: TestGenerateRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> TaskSubmitted:
    _get_celery()
    from app.workers.celery_app import run_test_generation
    task = run_test_generation.delay(
        user_id=current_user.id,
        pr_url=req.pr_url,
        language=req.language,
        framework=req.framework,
        test_type=req.test_type,
    )
    return TaskSubmitted(task_id=task.id)


# ── Submit report generation ──────────────────────────────────────────────────

@router.post(
    "/report-generate",
    response_model=TaskSubmitted,
    status_code=status.HTTP_202_ACCEPTED,
    responses={401: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Queue report generation in background",
    description="**Requires authentication.**",
)
async def submit_report_generation(
    req: ReportGenerateRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> TaskSubmitted:
    _get_celery()
    from app.workers.celery_app import run_report_generation
    task = run_report_generation.delay(
        user_id=current_user.id,
        report_config=req.model_dump(),
    )
    return TaskSubmitted(task_id=task.id)
