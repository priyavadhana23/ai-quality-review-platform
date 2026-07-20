"""
AI Security Scanner router.

All endpoints require a valid Bearer JWT.  Every query is scoped to
current_user.id — users cannot access each other's scan reports (IDOR prevention).

Routes
------
POST   /api/v1/security/analyze   — scan a PR URL or uploaded file/ZIP
GET    /api/v1/security/history   — paginated list of past scans
GET    /api/v1/security/{id}      — full scan report detail
DELETE /api/v1/security/{id}      — delete a scan report
"""
from __future__ import annotations

import io
import zipfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse
from app.schemas.security_scanner import (
    PaginatedScanList,
    SecurityScanReport,
    SecurityScanRequest,
)
from app.schemas.user import UserResponse
from app.services import security_scanner_service

router = APIRouter(prefix="/api/v1/security", tags=["Security Scanner"])

_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
_MAX_ZIP_EXTRACT_CHARS = 14_000       # characters sent to AI from ZIP


# ── Analyze ───────────────────────────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=SecurityScanReport,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid token"},
        413: {"model": ErrorResponse, "description": "File too large (max 5 MB)"},
        422: {"model": ErrorResponse, "description": "Invalid input"},
        502: {"model": ErrorResponse, "description": "AI engine error"},
    },
    summary="Run an AI security scan",
    description=(
        "Accepts a GitHub PR URL **or** an uploaded source file / ZIP archive and "
        "performs a comprehensive AI security analysis using the existing "
        "Gemini/LiteLLM pipeline. **Requires authentication.**"
    ),
)
async def analyze(
    pr_url: str | None = Form(None, description="GitHub pull-request URL"),
    file: UploadFile | None = File(None, description="Source file or ZIP archive"),
    current_user: UserResponse = Depends(get_current_user),
) -> SecurityScanReport:
    """Scan a PR URL or uploaded source file."""
    if pr_url is None and file is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either a pr_url or a file upload.",
        )

    # ── PR URL path ────────────────────────────────────────────────────────
    if pr_url is not None:
        pr_url = pr_url.strip()
        try:
            # Reuse the Pydantic validator via the request model
            req = SecurityScanRequest(pr_url=pr_url)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        return await security_scanner_service.scan_pr(
            user_id=current_user.id,
            pr_url=req.pr_url,
        )

    # ── File upload path ───────────────────────────────────────────────────
    assert file is not None
    raw = await file.read()
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {_MAX_UPLOAD_BYTES // 1024 // 1024} MB).",
        )

    filename = file.filename or "upload"
    scan_type = "zip" if filename.lower().endswith(".zip") else "file"

    if scan_type == "zip":
        # Extract text from all source files in the ZIP, up to the char limit.
        content_parts: list[str] = []
        total_chars = 0
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                # Sort for determinism; skip __pycache__, .git, binaries
                names = sorted(
                    n for n in zf.namelist()
                    if not any(skip in n for skip in ("__pycache__", ".git", ".pyc", ".class"))
                    and not n.endswith("/")
                )
                for name in names:
                    if total_chars >= _MAX_ZIP_EXTRACT_CHARS:
                        break
                    try:
                        file_bytes = zf.read(name)
                        text = file_bytes.decode("utf-8", errors="replace")
                        remaining = _MAX_ZIP_EXTRACT_CHARS - total_chars
                        chunk = text[:remaining]
                        content_parts.append(f"### {name}\n{chunk}")
                        total_chars += len(chunk)
                    except Exception:
                        pass
        except zipfile.BadZipFile:
            raise HTTPException(status_code=422, detail="Invalid ZIP archive.")
        content = "\n\n".join(content_parts) or "(empty archive)"
    else:
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=422, detail="File must be UTF-8 encoded text.")

    if not content.strip():
        raise HTTPException(status_code=422, detail="File content is empty.")

    return await security_scanner_service.scan_content(
        user_id=current_user.id,
        content=content,
        filename=filename,
        scan_type=scan_type,
    )


# ── History ───────────────────────────────────────────────────────────────────

@router.get(
    "/history",
    response_model=PaginatedScanList,
    responses={401: {"model": ErrorResponse}},
    summary="List security scan history",
    description=(
        "Returns paginated scan history for the authenticated user. "
        "**Requires authentication.**"
    ),
)
async def list_scans(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    scan_type: str | None = Query(None, description="Filter by scan type (pr | zip | file)"),
    current_user: UserResponse = Depends(get_current_user),
) -> PaginatedScanList:
    return await security_scanner_service.list_scans(
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        scan_type=scan_type,
    )


# ── Get by ID ─────────────────────────────────────────────────────────────────

@router.get(
    "/{scan_id}",
    response_model=SecurityScanReport,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse, "description": "Report not found or not owned"},
    },
    summary="Get a security scan report by ID",
    description=(
        "Returns the full scan report. Returns 404 if not found or owned by "
        "another user. **Requires authentication.**"
    ),
)
async def get_scan(
    scan_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> SecurityScanReport:
    report = await security_scanner_service.get_scan(scan_id, current_user.id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan report {scan_id} not found",
        )
    return report


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete(
    "/{scan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse, "description": "Report not found or not owned"},
    },
    summary="Delete a security scan report",
    description=(
        "Permanently deletes a scan report owned by the authenticated user. "
        "**Requires authentication.**"
    ),
)
async def delete_scan(
    scan_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> None:
    deleted = await security_scanner_service.delete_scan(scan_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan report {scan_id} not found",
        )
