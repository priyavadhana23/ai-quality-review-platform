"""
Domain exceptions for the API application layer.

These are raised by service methods and caught by the global exception
handlers registered in ``app/main.py``.  They are never raised inside
the PR-Agent engine itself.
"""
from __future__ import annotations


class PRAgentAPIError(Exception):
    """Base class for all application-layer errors."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InvalidPRURLError(PRAgentAPIError):
    """Raised when a supplied PR URL is malformed or cannot be resolved."""

    def __init__(self, url: str) -> None:
        super().__init__(
            message=f"Invalid or unreachable PR URL: {url!r}",
            status_code=422,
        )
        self.url = url


class PRAgentExecutionError(PRAgentAPIError):
    """Raised when the PR-Agent engine raises an unrecoverable error."""

    def __init__(self, tool: str, detail: str) -> None:
        super().__init__(
            message=f"PR-Agent engine failed while running '{tool}': {detail}",
            status_code=502,
        )
        self.tool = tool
        self.detail = detail


class EmptyResultError(PRAgentAPIError):
    """Raised when the engine returns no usable output."""

    def __init__(self, tool: str) -> None:
        super().__init__(
            message=f"PR-Agent '{tool}' produced no output — check the PR URL and AI configuration.",
            status_code=204,
        )
        self.tool = tool
