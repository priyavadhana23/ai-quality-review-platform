"""
Response formatting utilities.

Transforms the raw artifact text produced by PR-Agent tool runs into the
structured ``SuccessResponse`` envelope served by the API.
"""
from __future__ import annotations

from typing import Any

from app.schemas.common import SuccessResponse


def build_success_response(
    tool: str,
    execution_time: float,
    raw_artifact: Any,
) -> SuccessResponse:
    """Wrap a PR-Agent artifact inside the standard success envelope.

    Args:
        tool: The name of the tool that produced the artifact
              (e.g. ``"review"``, ``"describe"``).
        execution_time: How long the engine took, in seconds.
        raw_artifact: The value stored in ``get_settings().data["artifact"]``
                      by the PR-Agent engine when ``publish_output=False``.
                      Typically a markdown string, but may also be a dict.

    Returns:
        A ``SuccessResponse`` instance ready for JSON serialisation.
    """
    # Normalise the artifact so the API always returns a dict at the top level.
    if isinstance(raw_artifact, str):
        data: dict[str, Any] = {"output": raw_artifact}
    elif isinstance(raw_artifact, dict):
        data = raw_artifact
    else:
        # Fallback for unexpected types — convert to string representation.
        data = {"output": str(raw_artifact)}

    return SuccessResponse(
        tool=tool,
        execution_time=round(execution_time, 3),
        data=data,
    )
