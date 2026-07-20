"""
Ask service.

Delegates to the PR-Agent ``ask`` command.  Unlike the other tools,
``ask`` requires a ``question`` string that is forwarded to the engine
as a CLI-style argument (matching how ``PRQuestions.parse_args`` works).
"""
from __future__ import annotations

from app.schemas.common import SuccessResponse
from app.services.base_service import BasePRAgentService
from app.utils.response import build_success_response


class AskService(BasePRAgentService):
    """Service that invokes ``PRQuestions`` through the PR-Agent engine."""

    tool_name: str = "ask"

    async def run(  # type: ignore[override]
        self,
        pr_url: str,
        question: str,
    ) -> SuccessResponse:
        """
        Execute the ``ask`` command and return a formatted response.

        The question is forwarded as a positional argument so that
        ``PRQuestions.parse_args()`` receives it exactly as it would
        from the CLI: ``pr-agent --pr_url=... ask "question text"``.

        Args:
            pr_url: Full pull-request URL.
            question: The natural-language question about the PR.

        Returns:
            A ``SuccessResponse`` instance containing the AI answer.
        """
        artifact, elapsed = await self._invoke_engine(
            pr_url=pr_url,
            command=self.tool_name,
            args=[question],
        )
        return build_success_response(
            tool=self.tool_name,
            execution_time=elapsed,
            raw_artifact=artifact,
        )
