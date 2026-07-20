"""
Request / response logging middleware.

Logs every incoming request and its eventual status code and duration.
Sensitive header values are never emitted.
"""
from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logger import get_logger


class LoggingMiddleware(BaseHTTPMiddleware):
    """Logs method, path, status code, and duration for every request."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        """Process the request and emit structured log lines."""
        logger = get_logger()
        request_id = uuid.uuid4().hex[:8]
        start = time.monotonic()

        logger.info(
            f"[{request_id}] → {request.method} {request.url.path}",
        )

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            elapsed = time.monotonic() - start
            logger.error(
                f"[{request_id}] ✗ {request.method} {request.url.path} "
                f"unhandled exception after {elapsed:.3f}s: {exc}",
            )
            raise

        elapsed = time.monotonic() - start
        logger.info(
            f"[{request_id}] ← {request.method} {request.url.path} "
            f"HTTP {response.status_code} in {elapsed:.3f}s",
        )
        return response
