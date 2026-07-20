"""
API Quality Analyzer router.

All endpoints require a valid Bearer JWT.  Every query is scoped to
current_user.id — users cannot access each other's reports (IDOR prevention).

Routes
------
POST   /api/v1/api-quality/analyze    — upload spec (file or URL) → run analysis
GET    /api/v1/api-quality/history    — paginated list of past reports
GET    /api/v1/api-quality/{id}       — full report detail
DELETE /api/v1/api-quality/{id}       — delete a report
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.auth.dependencies import get_current_user
from app.schemas.api_quality import ApiQualityReport, PaginatedReportList
from app.schemas.common import ErrorResponse
from app.schemas.user import UserResponse
from app.services import api_quality_service

router = APIRouter(prefix="/api/v1/api-quality", tags=["API Quality"])

_MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MB


# ── Analyze ───────────────────────────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=ApiQualityReport,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        413: {"model": ErrorResponse, "description": "Spec file too large (max 2 MB)"},
        422: {"model": ErrorResponse, "description": "Invalid or unparseable specification"},
        502: {"model": ErrorResponse, "description": "AI engine error"},
    },
    summary="Analyse an OpenAPI/Swagger specification",
    description=(
        "Accepts an OpenAPI 3.x or Swagger 2.0 specification as a file upload "
        "**or** a publicly accessible URL, then runs a comprehensive AI quality "
        "analysis using the existing Gemini/LiteLLM pipeline. "
        "**Requires authentication.**"
    ),
)
async def analyze_spec(
    file: UploadFile | None = File(None, description="YAML or JSON spec file"),
    spec_url: str | None = Form(None, description="URL of a publicly accessible spec"),
    current_user: UserResponse = Depends(get_current_user),
) -> ApiQualityReport:
    """Analyse an API spec provided as a file upload or URL."""
    if file is None and not spec_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either a file upload or a spec_url.",
        )

    # ── Resolve spec content ───────────────────────────────────────────────
    if file is not None:
        raw = await file.read()
        if len(raw) > _MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large (max {_MAX_UPLOAD_BYTES // 1024} KB).",
            )
        try:
            spec_content = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=422, detail="File must be UTF-8 encoded text.")
        filename = file.filename or "spec.yaml"
    else:
        # URL path
        assert spec_url is not None
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(spec_url)
                resp.raise_for_status()
                spec_content = resp.text
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Could not fetch spec URL: {exc}",
            )
        # Derive a filename from the URL
        filename = spec_url.rstrip("/").rsplit("/", 1)[-1] or "spec.yaml"
        if "." not in filename:
            filename += ".yaml"

    if not spec_content.strip():
        raise HTTPException(status_code=422, detail="Specification content is empty.")

    return await api_quality_service.analyze_spec(
        user_id=current_user.id,
        spec_content=spec_content,
        filename=filename,
    )


# ── History ───────────────────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=PaginatedReportList,
    responses={401: {"model": ErrorResponse}},
    summary="List API quality report history",
    description="Returns paginated history of analyses for the authenticated user. **Requires authentication.**",
)
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: UserResponse = Depends(get_current_user),
) -> PaginatedReportList:
    return await api_quality_service.list_reports(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )


# ── Get by ID ─────────────────────────────────────────────────────────────────

@router.get(
    "/{report_id}",
    response_model=ApiQualityReport,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse, "description": "Report not found or not owned"},
    },
    summary="Get a quality report by ID",
    description=(
        "Returns full report detail. Returns 404 if not found or owned by another user. "
        "**Requires authentication.**"
    ),
)
async def get_report(
    report_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> ApiQualityReport:
    report = await api_quality_service.get_report(report_id, current_user.id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Report {report_id} not found")
    return report


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse, "description": "Report not found or not owned"},
    },
    summary="Delete a quality report",
    description="Permanently deletes a report owned by the authenticated user. **Requires authentication.**",
)
async def delete_report(
    report_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> None:
    deleted = await api_quality_service.delete_report(report_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Report {report_id} not found")
