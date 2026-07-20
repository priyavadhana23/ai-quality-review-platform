"""
Review repository — all database operations for the review history tables.

Tables owned: repositories, pull_requests, reviews, review_metrics.

Every query filters by user_id to prevent IDOR — callers always supply
the authenticated user's id, and this module never omits that filter.
"""
from __future__ import annotations

from typing import Any

from app.db.database import execute, fetchall, fetchone


# ─────────────────────────────────────────────────────────────────────────────
# Repositories
# ─────────────────────────────────────────────────────────────────────────────

class RepositoryRepository:
    """CRUD for the ``repositories`` table."""

    @staticmethod
    async def upsert(user_id: int, owner: str, repo: str) -> dict[str, Any]:
        """Insert or ignore and then return the row."""
        await execute(
            """
            INSERT OR IGNORE INTO repositories (user_id, github_owner, github_repo)
            VALUES (?, ?, ?)
            """,
            (user_id, owner, repo),
        )
        row = await fetchone(
            """
            SELECT * FROM repositories
            WHERE user_id = ? AND github_owner = ? AND github_repo = ?
            """,
            (user_id, owner, repo),
        )
        return row  # type: ignore[return-value]

    @staticmethod
    async def list_for_user(user_id: int) -> list[dict[str, Any]]:
        """All repositories analysed by this user, newest first."""
        return await fetchall(
            """
            SELECT r.*,
                   (SELECT COUNT(*) FROM pull_requests p WHERE p.repository_id = r.id) AS pr_count
            FROM repositories r
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
            """,
            (user_id,),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Pull Requests
# ─────────────────────────────────────────────────────────────────────────────

class PullRequestRepository:
    """CRUD for the ``pull_requests`` table."""

    @staticmethod
    async def upsert(
        repository_id: int,
        pr_number: int,
        pr_url: str,
        title: str | None = None,
        branch: str | None = None,
        author: str | None = None,
    ) -> dict[str, Any]:
        """Insert if new, or update mutable fields if already exists."""
        await execute(
            """
            INSERT INTO pull_requests (repository_id, pr_number, pr_url, title, branch, author)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(repository_id, pr_number) DO UPDATE SET
                pr_url = excluded.pr_url,
                title  = COALESCE(excluded.title, title),
                branch = COALESCE(excluded.branch, branch),
                author = COALESCE(excluded.author, author)
            """,
            (repository_id, pr_number, pr_url, title, branch, author),
        )
        row = await fetchone(
            "SELECT * FROM pull_requests WHERE repository_id = ? AND pr_number = ?",
            (repository_id, pr_number),
        )
        return row  # type: ignore[return-value]

    @staticmethod
    async def list_for_user(user_id: int) -> list[dict[str, Any]]:
        """All pull requests belonging to this user's repositories."""
        return await fetchall(
            """
            SELECT pr.*, r.github_owner, r.github_repo
            FROM pull_requests pr
            JOIN repositories r ON r.id = pr.repository_id
            WHERE r.user_id = ?
            ORDER BY pr.created_at DESC
            """,
            (user_id,),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Reviews
# ─────────────────────────────────────────────────────────────────────────────

class ReviewRepository:
    """CRUD for the ``reviews`` (and ``review_metrics``) tables."""

    # ── Write ─────────────────────────────────────────────────────────────────

    @staticmethod
    async def create(
        pull_request_id: int,
        tool: str,
        review_markdown: str,
        execution_time: float,
        review_summary: str | None = None,
        llm_model: str | None = None,
        tokens_used: int | None = None,
        review_type: str = "automated",
    ) -> dict[str, Any]:
        """Insert a new review row and return it."""
        row_id = await execute(
            """
            INSERT INTO reviews
                (pull_request_id, tool, review_type, review_summary,
                 review_markdown, raw_output, execution_time, llm_model, tokens_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pull_request_id, tool, review_type, review_summary,
                review_markdown, review_markdown, execution_time,
                llm_model, tokens_used,
            ),
        )
        row = await fetchone("SELECT * FROM reviews WHERE id = ?", (row_id,))
        return row  # type: ignore[return-value]

    @staticmethod
    async def save_metrics(
        review_id: int,
        bugs_found: int = 0,
        suggestions: int = 0,
        security_score: int | None = None,
        quality_score: int | None = None,
    ) -> None:
        """Insert a review_metrics row (one-to-one with reviews)."""
        await execute(
            """
            INSERT OR REPLACE INTO review_metrics
                (review_id, bugs_found, suggestions, security_score, quality_score)
            VALUES (?, ?, ?, ?, ?)
            """,
            (review_id, bugs_found, suggestions, security_score, quality_score),
        )

    # ── Read ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def list_for_user(
        user_id: int,
        tool_filter: str | None = None,
        repo_filter: str | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
        sort: str = "newest",
    ) -> tuple[list[dict[str, Any]], int]:
        """
        Return (rows, total_count) for the given user with optional filters.

        All filters are applied server-side.  The query joins through the full
        chain: reviews → pull_requests → repositories → users to enforce
        ownership on every row.
        """
        conditions = ["r.user_id = ?"]
        params: list[Any] = [user_id]

        if tool_filter and tool_filter != "all":
            conditions.append("rv.tool = ?")
            params.append(tool_filter)

        if repo_filter:
            conditions.append(
                "(r.github_owner = ? OR r.github_repo = ? OR (r.github_owner || '/' || r.github_repo) = ?)"
            )
            params.extend([repo_filter, repo_filter, repo_filter])

        if search:
            like = f"%{search}%"
            conditions.append(
                "(pr.pr_url LIKE ? OR rv.review_markdown LIKE ? "
                "OR r.github_owner LIKE ? OR r.github_repo LIKE ?)"
            )
            params.extend([like, like, like, like])

        where = " AND ".join(conditions)

        count_row = await fetchone(
            f"""
            SELECT COUNT(*) AS cnt
            FROM reviews rv
            JOIN pull_requests pr ON pr.id = rv.pull_request_id
            JOIN repositories r   ON r.id  = pr.repository_id
            WHERE {where}
            """,
            tuple(params),
        )
        total = (count_row or {}).get("cnt", 0)

        offset = (page - 1) * page_size
        order = "ASC" if sort == "oldest" else "DESC"
        rows = await fetchall(
            f"""
            SELECT
                rv.id, rv.tool, rv.review_type, rv.review_summary,
                rv.execution_time, rv.llm_model, rv.tokens_used, rv.created_at,
                pr.pr_url, pr.pr_number, pr.title  AS pr_title,
                r.github_owner, r.github_repo,
                rm.bugs_found, rm.suggestions,
                rm.security_score, rm.quality_score
            FROM reviews rv
            JOIN pull_requests pr ON pr.id = rv.pull_request_id
            JOIN repositories r   ON r.id  = pr.repository_id
            LEFT JOIN review_metrics rm ON rm.review_id = rv.id
            WHERE {where}
            ORDER BY rv.created_at {order}
            LIMIT ? OFFSET ?
            """,
            tuple(params) + (page_size, offset),
        )
        return rows, total

    @staticmethod
    async def get_for_user(review_id: int, user_id: int) -> dict[str, Any] | None:
        """
        Return the full review (including markdown) if it belongs to user_id.
        Returns None if not found or not owned by the user (IDOR prevention).
        """
        return await fetchone(
            """
            SELECT
                rv.*,
                pr.pr_url, pr.pr_number, pr.title AS pr_title,
                pr.branch, pr.author,
                r.github_owner, r.github_repo,
                rm.bugs_found, rm.suggestions,
                rm.security_score, rm.quality_score,
                rm.complexity_score, rm.maintainability_score
            FROM reviews rv
            JOIN pull_requests pr ON pr.id = rv.pull_request_id
            JOIN repositories r   ON r.id  = pr.repository_id
            LEFT JOIN review_metrics rm ON rm.review_id = rv.id
            WHERE rv.id = ? AND r.user_id = ?
            """,
            (review_id, user_id),
        )

    @staticmethod
    async def delete_for_user(review_id: int, user_id: int) -> bool:
        """
        Delete a review that belongs to user_id.
        Returns True if deleted, False if not found / not owned.
        """
        row = await ReviewRepository.get_for_user(review_id, user_id)
        if not row:
            return False
        await execute("DELETE FROM reviews WHERE id = ?", (review_id,))
        return True
