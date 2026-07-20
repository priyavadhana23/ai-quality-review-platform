"""
Review service.

Delegates to the PR-Agent ``review`` command via the base service.
No AI logic is implemented here — this is a pure pass-through.
"""
from __future__ import annotations

from app.services.base_service import BasePRAgentService


class ReviewService(BasePRAgentService):
    """Service that invokes ``PRReviewer`` through the PR-Agent engine."""

    tool_name: str = "review"
