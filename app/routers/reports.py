"""
Enterprise Report Generator router.

All endpoints require a valid Bearer JWT.  Every query is scoped to
current_user.id — users cannot access each other's reports (IDOR prevention).

Routes
------
POST   /api/v1/reports/generate   — generate a new report
GET    /api/v1/reports/history    — paginated list of past reports
GET    /api/v1/reports/{id}       — full report including content
DELETE /api/v1/reports/{id}       — delete a report
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse
from app.schemas.reports import GeneratedReport, PaginatedReportList, ReportGenerateRequest
from app.schemas.user import UserResponse
from app.services import report_generator_service

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


@router.post(
    "/generate",
    response_model=GeneratedReport,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    summary="Generate an enterprise report",
    description=(
        "Aggregates data from all AI modules and produces a professional report "
        "in Markdown, HTML, or JSON format. **Requires authentication.**"
    ),
)
async def generate_report(
    req: ReportGenerateRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> GeneratedReport:
    return await report_generator_service.generate_report(
        user_id=current_user.id,
        req=req,
    )


@router.get(
    "/history",
    response_model=PaginatedReportList,
    responses={401: {"model": ErrorResponse}},
    summary="List generated report history",
    description="Returns paginated history of reports for the authenticated user. **Requires authentication.**",
)
async def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    report_type: str | None = Query(None, description="Filter by report type"),
    current_user: UserResponse = Depends(get_current_user),
) -> PaginatedReportList:
    return await report_generator_service.list_reports(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        report_type=report_type,
    )


@router.get(
    "/{report_id}",
    response_model=GeneratedReport,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    summary="Get a report by ID",
    description="Returns the full report including rendered content. **Requires authentication.**",
)
async def get_report(
    report_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> GeneratedReport:
    report = await report_generator_service.get_report(report_id, current_user.id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {report_id} not found",
        )
    return report


@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
    },
    summary="Delete a report",
    description="Permanently deletes a report owned by the authenticated user. **Requires authentication.**",
)
async def delete_report(
    report_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> None:
    deleted = await report_generator_service.delete_report(report_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {report_id} not found",
        )
