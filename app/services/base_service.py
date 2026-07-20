"""
Base service class shared by all tool-specific services.

Captures PR-Agent output via publish_output=False, then (when a user_id
is supplied) persists the review to the database as a fire-and-forget
background task so client latency is unaffected.

The PR-Agent engine code is NEVER modified.
"""
from __future__ import annotations

import asyncio
import time
import traceback
from typing import Any

from pr_agent.agent.pr_agent import PRAgent
from pr_agent.config_loader import get_settings

from app.core.exceptions import EmptyResultError, PRAgentExecutionError
from app.core.logger import get_logger
from app.utils.response import build_success_response


class BasePRAgentService:
    """Invoke a PR-Agent command and return its output as a SuccessResponse."""

    tool_name: str = ""

    async def _invoke_engine(
        self,
        pr_url: str,
        command: str,
        args: list[str] | None = None,
    ) -> tuple[Any, float]:
        """
        Run a PR-Agent command with publish_output=False and capture the artifact.

        Returns:
            ``(artifact, elapsed_seconds)``
        """
        logger = get_logger()
        start = time.monotonic()

        settings = get_settings()
        original_publish = settings.get("config.publish_output", True)
        settings.set("config.publish_output", False)

        if hasattr(settings, "data"):
            settings.data = {}

        request: list[str] | str = [command] + args if args else command

        try:
            agent = PRAgent()
            success = await agent.handle_request(pr_url=pr_url, request=request)
        except Exception as exc:
            logger.error(
                f"PR-Agent engine raised an exception for '{command}' on {pr_url}: {exc}",
                artifact={"traceback": traceback.format_exc()},
            )
            raise PRAgentExecutionError(tool=command, detail=str(exc)) from exc
        finally:
            settings.set("config.publish_output", original_publish)

        elapsed = time.monotonic() - start
        logger.info(f"PR-Agent '{command}' completed in {elapsed:.2f}s for {pr_url}")

        if not success:
            raise PRAgentExecutionError(
                tool=command,
                detail="handle_request returned False — check PR URL and API key.",
            )

        artifact: Any = None
        if hasattr(settings, "data") and isinstance(settings.data, dict):
            artifact = settings.data.get("artifact")

        if not artifact:
            raise EmptyResultError(tool=command)

        return artifact, elapsed

    async def run(
        self,
        pr_url: str,
        extra_args: list[str] | None = None,
        user_id: int | None = None,
    ):
        """
        Execute the tool, build the response, and optionally persist the review.

        Args:
            pr_url:     Full pull-request URL.
            extra_args: Optional CLI-style arguments forwarded to the tool.
            user_id:    If provided, the review is saved to the database
                        asynchronously (fire-and-forget).

        Returns:
            A ``SuccessResponse`` instance.
        """
        artifact, elapsed = await self._invoke_engine(
            pr_url=pr_url,
            command=self.tool_name,
            args=extra_args,
        )
        response = build_success_response(
            tool=self.tool_name,
            execution_time=elapsed,
            raw_artifact=artifact,
        )

        # ── Fire-and-forget persistence ────────────────────────────────────
        if user_id is not None:
            markdown = (
                artifact if isinstance(artifact, str)
                else artifact.get("output", str(artifact))
                if isinstance(artifact, dict)
                else str(artifact)
            )
            asyncio.create_task(
                _persist_review(
                    user_id=user_id,
                    pr_url=pr_url,
                    tool=self.tool_name,
                    markdown=markdown,
                    execution_time=elapsed,
                )
            )

        return response


async def _persist_review(
    user_id: int,
    pr_url: str,
    tool: str,
    markdown: str,
    execution_time: float,
) -> None:
    """Background task — save the review.  Never raises."""
    try:
        from app.services.history_service import save_review
        await save_review(
            user_id=user_id,
            pr_url=pr_url,
            tool=tool,
            markdown=markdown,
            execution_time=execution_time,
        )
    except Exception as exc:
        get_logger().error(f"_persist_review failed silently: {exc}")
