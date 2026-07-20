"""
History service — orchestrates automatic review persistence.

Design:
  • parse_pr_url() extracts owner, repo, and PR number from any GitHub URL.
  • save_review() is called fire-and-forget from base_service.run().
    It upserts the repository row, upserts the pull-request row, inserts
    the review, and inserts basic metrics — all in the same SQLite thread.
  • list_reviews(), get_review(), delete_review() enforce user ownership
    on every read/write (IDOR prevention).

Nothing in this module touches the PR-Agent engine.
"""
from __future__ import annotations

import math
import re

from app.core.logger import get_logger
from app.db.review_repository import (
    PullRequestRepository,
    RepositoryRepository,
    ReviewRepository,
)
from app.schemas.history import (
    PaginatedReviewList,
    PullRequestResponse,
    RepositoryResponse,
    ReviewDetail,
    ReviewListItem,
)


# ── GitHub PR URL parser ───────────────────────────────────────────────────────

_PR_URL_RE = re.compile(
    r"https?://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+)/pull/(?P<number>\d+)",
    re.IGNORECASE,
)


def parse_pr_url(pr_url: str) -> tuple[str, str, int] | None:
    """
    Extract (owner, repo, pr_number) from a GitHub PR URL.
    Returns None if the URL doesn't match the expected pattern.
    """
    m = _PR_URL_RE.search(pr_url)
    if not m:
        return None
    return m.group("owner"), m.group("repo"), int(m.group("number"))


def _count_metrics(markdown: str, tool: str) -> tuple[int, int]:
    """
    Naively estimate bugs_found and suggestions from the markdown body.
    These are informational estimates, not ground-truth counts.
    """
    bugs = 0
    suggestions = 0
    lower = markdown.lower()

    if tool == "review":
        # Count bullet-point security/bug keywords
        bugs = sum(
            lower.count(kw)
            for kw in ("security concern", "possible bug", "possible issue", "vulnerability")
        )
        suggestions = lower.count("recommendation")

    elif tool == "improve":
        # Each '## ' block is roughly one suggestion
        suggestions = lower.count("\n## ") + lower.count("\n**")

    elif tool == "describe":
        suggestions = 1  # one description generated

    elif tool == "ask":
        suggestions = 1

    return max(0, bugs), max(0, suggestions)


# ── Main entry point: called by base_service after each AI run ────────────────

async def save_review(
    user_id: int,
    pr_url: str,
    tool: str,
    markdown: str,
    execution_time: float,
) -> int | None:
    """
    Persist a completed review.  Returns the new review.id, or None on error.

    This function is called fire-and-forget — errors are logged but never
    propagated to the caller so latency is unaffected.
    """
    logger = get_logger()
    try:
        parsed = parse_pr_url(pr_url)
        if not parsed:
            logger.warning(f"history_service.save_review: cannot parse PR URL '{pr_url}'")
            return None

        owner, repo, pr_number = parsed

        # 1. Upsert repository
        repo_row = await RepositoryRepository.upsert(user_id, owner, repo)
        repo_id = repo_row["id"]

        # 2. Upsert pull request
        pr_row = await PullRequestRepository.upsert(
            repository_id=repo_id,
            pr_number=pr_number,
            pr_url=pr_url,
        )
        pr_id = pr_row["id"]

        # 3. Derive a short summary from the first non-empty line
        first_line = next(
            (ln.lstrip("#").strip() for ln in markdown.splitlines() if ln.strip()),
            None,
        )
        summary = (first_line[:200] if first_line else None)

        # 4. Get configured model name for record-keeping
        try:
            from pr_agent.config_loader import get_settings as _get_pr_settings
            llm_model = _get_pr_settings().get("config.model", None)
        except Exception:
            llm_model = None

        # 5. Insert review
        review_row = await ReviewRepository.create(
            pull_request_id=pr_id,
            tool=tool,
            review_markdown=markdown,
            execution_time=round(execution_time, 3),
            review_summary=summary,
            llm_model=llm_model,
        )
        review_id = review_row["id"]

        # 6. Insert basic metrics
        bugs, suggestions = _count_metrics(markdown, tool)
        await ReviewRepository.save_metrics(
            review_id=review_id,
            bugs_found=bugs,
            suggestions=suggestions,
        )

        logger.info(f"Review saved: id={review_id} tool={tool} pr={pr_url}")
        return review_id

    except Exception as exc:
        logger.error(f"history_service.save_review failed: {exc}")
        return None


# ── Read / List / Delete ──────────────────────────────────────────────────────

async def list_reviews(
    user_id: int,
    tool_filter: str | None = None,
    repo_filter: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str = "newest",
) -> PaginatedReviewList:
    """Return a paginated list of reviews for user_id."""
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    sort = sort if sort in ("newest", "oldest") else "newest"
    rows, total = await ReviewRepository.list_for_user(
        user_id=user_id,
        tool_filter=tool_filter,
        repo_filter=repo_filter,
        search=search,
        page=page,
        page_size=page_size,
        sort=sort,
    )
    total_pages = max(math.ceil(total / page_size), 1)
    return PaginatedReviewList(
        items=[ReviewListItem.from_db(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_review(review_id: int, user_id: int) -> ReviewDetail | None:
    """Return a single full review if owned by user_id, else None."""
    row = await ReviewRepository.get_for_user(review_id, user_id)
    return ReviewDetail.from_db(row) if row else None


async def delete_review(review_id: int, user_id: int) -> bool:
    """Delete a review if owned by user_id.  Returns True on success."""
    return await ReviewRepository.delete_for_user(review_id, user_id)


async def list_repositories(user_id: int) -> list[RepositoryResponse]:
    """Return all repositories analysed by user_id."""
    rows = await RepositoryRepository.list_for_user(user_id)
    return [RepositoryResponse.from_db(r) for r in rows]


async def list_pull_requests(user_id: int) -> list[PullRequestResponse]:
    """Return all pull requests belonging to user_id's repositories."""
    rows = await PullRequestRepository.list_for_user(user_id)
    return [PullRequestResponse.from_db(r) for r in rows]
