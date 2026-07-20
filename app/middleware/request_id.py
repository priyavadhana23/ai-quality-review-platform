"""
Request ID middleware.

Adds a unique X-Request-ID to every request (generates one if not supplied)
and a X-Correlation-ID that is propagated through to responses.
Both IDs are injected into the logging context via Python's contextvars.
"""
from __future__ import annotations

import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="-")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: object) -> Response:
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        corr_id = request.headers.get("X-Correlation-ID") or req_id

        token_req = request_id_var.set(req_id)
        token_corr = correlation_id_var.set(corr_id)

        try:
            response: Response = await call_next(request)  # type: ignore[call-arg]
            response.headers["X-Request-ID"] = req_id
            response.headers["X-Correlation-ID"] = corr_id
            return response
        finally:
            request_id_var.reset(token_req)
            correlation_id_var.reset(token_corr)
