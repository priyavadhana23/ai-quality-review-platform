"""
Analytics service — aggregates stored review data into dashboard metrics.

All queries are scoped to user_id (IDOR prevention).  No writes happen here.
Every function accepts optional filter kwargs that map 1-to-1 to the query
params on the analytics router.

SQL is written directly against the four review-related tables:
  repositories, pull_requests, reviews, review_metrics
"""
from __future__ import annotations

from typing import Any

from app.db.database import fetchall, fetchone
from app.schemas.analytics import (
    ModelAnalytics,
    ModelAnalyticsList,
    OverviewMetrics,
    PerformanceAnalytics,
    RepositoryAnalytics,
    RepositoryAnalyticsList,
    SecurityAnalytics,
    TrendAnalytics,
    TrendDataPoint,
)


# ── Shared WHERE-clause builder ───────────────────────────────────────────────

def _build_filters(
    user_id: int,
    repo: str | None = None,
    tool: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> tuple[str, list[Any]]:
    """
    Build a WHERE clause and params list for the standard review join.

    The join must be present in the caller's query:
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
    """
    conditions = ["r.user_id = ?"]
    params: list[Any] = [user_id]

    if repo:
        conditions.append(
            "(r.github_owner = ? OR r.github_repo = ? "
            "OR (r.github_owner || '/' || r.github_repo) = ?)"
        )
        params.extend([repo, repo, repo])

    if tool and tool != "all":
        conditions.append("rv.tool = ?")
        params.append(tool)

    if model:
        conditions.append("rv.llm_model = ?")
        params.append(model)

    if date_from:
        conditions.append("rv.created_at >= ?")
        params.append(date_from)

    if date_to:
        conditions.append("rv.created_at <= ?")
        params.append(date_to + " 23:59:59")

    return " AND ".join(conditions), params


def _safe_float(value: Any, decimals: int = 2) -> float | None:
    """Return a rounded float or None when value is None."""
    if value is None:
        return None
    return round(float(value), decimals)


# ── Overview ──────────────────────────────────────────────────────────────────

async def get_overview(
    user_id: int,
    repo: str | None = None,
    tool: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> OverviewMetrics:
    """Return aggregate metrics across all matching reviews."""
    where, params = _build_filters(user_id, repo, tool, model, date_from, date_to)

    agg = await fetchone(
        f"""
        SELECT
            COUNT(rv.id)                          AS total_reviews,
            COUNT(DISTINCT r.id)                  AS repositories_analysed,
            COUNT(DISTINCT pr.id)                 AS pull_requests_reviewed,
            AVG(rv.execution_time)                AS avg_review_time,
            AVG(rm.quality_score)                 AS avg_quality_score,
            AVG(rm.security_score)                AS avg_security_score,
            AVG(rm.maintainability_score)         AS avg_maintainability_score,
            AVG(rm.complexity_score)              AS avg_complexity_score,
            AVG(COALESCE(rm.bugs_found, 0))       AS avg_bugs_found,
            AVG(COALESCE(rm.suggestions, 0))      AS avg_suggestions,
            MAX(rv.created_at)                    AS latest_review_date
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        LEFT JOIN review_metrics rm ON rm.review_id = rv.id
        WHERE {where}
        """,
        tuple(params),
    )

    # Most-used model
    model_row = await fetchone(
        f"""
        SELECT rv.llm_model, COUNT(*) AS cnt
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        WHERE {where} AND rv.llm_model IS NOT NULL
        GROUP BY rv.llm_model
        ORDER BY cnt DESC
        LIMIT 1
        """,
        tuple(params),
    )

    # Reviews by tool
    tool_rows = await fetchall(
        f"""
        SELECT rv.tool, COUNT(*) AS cnt
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        WHERE {where}
        GROUP BY rv.tool
        """,
        tuple(params),
    )

    agg = agg or {}
    return OverviewMetrics(
        total_reviews=agg.get("total_reviews") or 0,
        repositories_analysed=agg.get("repositories_analysed") or 0,
        pull_requests_reviewed=agg.get("pull_requests_reviewed") or 0,
        avg_review_time=round(float(agg.get("avg_review_time") or 0), 2),
        avg_quality_score=_safe_float(agg.get("avg_quality_score")),
        avg_security_score=_safe_float(agg.get("avg_security_score")),
        avg_maintainability_score=_safe_float(agg.get("avg_maintainability_score")),
        avg_complexity_score=_safe_float(agg.get("avg_complexity_score")),
        avg_bugs_found=round(float(agg.get("avg_bugs_found") or 0), 2),
        avg_suggestions=round(float(agg.get("avg_suggestions") or 0), 2),
        most_used_model=(model_row or {}).get("llm_model"),
        latest_review_date=(agg.get("latest_review_date") or None),
        reviews_by_tool={r["tool"]: r["cnt"] for r in tool_rows},
    )


# ── Repository analytics ──────────────────────────────────────────────────────

async def get_repository_analytics(
    user_id: int,
    tool: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> RepositoryAnalyticsList:
    """Return per-repository metrics for all repos the user has reviewed."""
    where, params = _build_filters(
        user_id, repo=None, tool=tool, model=model,
        date_from=date_from, date_to=date_to,
    )

    rows = await fetchall(
        f"""
        SELECT
            r.github_owner,
            r.github_repo,
            COUNT(rv.id)                        AS review_count,
            AVG(rm.quality_score)               AS avg_quality_score,
            AVG(rm.security_score)              AS avg_security_score,
            AVG(rv.execution_time)              AS avg_review_time,
            AVG(COALESCE(rm.bugs_found, 0))     AS avg_bugs_found,
            AVG(COALESCE(rm.suggestions, 0))    AS avg_suggestions,
            MAX(rv.created_at)                  AS last_reviewed_date
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        LEFT JOIN review_metrics rm ON rm.review_id = rv.id
        WHERE {where}
        GROUP BY r.id, r.github_owner, r.github_repo
        ORDER BY review_count DESC
        """,
        tuple(params),
    )

    items = [
        RepositoryAnalytics(
            github_owner=row["github_owner"],
            github_repo=row["github_repo"],
            repo_label=f"{row['github_owner']}/{row['github_repo']}",
            review_count=row["review_count"] or 0,
            avg_quality_score=_safe_float(row.get("avg_quality_score")),
            avg_security_score=_safe_float(row.get("avg_security_score")),
            avg_review_time=round(float(row.get("avg_review_time") or 0), 2),
            avg_bugs_found=round(float(row.get("avg_bugs_found") or 0), 2),
            avg_suggestions=round(float(row.get("avg_suggestions") or 0), 2),
            last_reviewed_date=row.get("last_reviewed_date"),
        )
        for row in rows
    ]
    return RepositoryAnalyticsList(items=items)


# ── Trend analytics ───────────────────────────────────────────────────────────

async def get_trends(
    user_id: int,
    repo: str | None = None,
    tool: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> TrendAnalytics:
    """Return daily (30d), weekly (12w), and monthly (12m) trend series."""
    where, params = _build_filters(user_id, repo, tool, model, date_from, date_to)

    # Daily — last 30 days
    daily_rows = await fetchall(
        f"""
        SELECT
            date(rv.created_at)             AS date,
            COUNT(rv.id)                    AS reviews,
            AVG(rm.quality_score)           AS avg_quality,
            AVG(rm.security_score)          AS avg_security,
            AVG(rv.execution_time)          AS avg_review_time
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        LEFT JOIN review_metrics rm ON rm.review_id = rv.id
        WHERE {where}
          AND rv.created_at >= date('now', '-30 days')
        GROUP BY date(rv.created_at)
        ORDER BY date ASC
        """,
        tuple(params),
    )

    # Weekly — last 12 weeks (strftime %Y-W%W)
    weekly_rows = await fetchall(
        f"""
        SELECT
            strftime('%Y-W%W', rv.created_at)   AS date,
            COUNT(rv.id)                         AS reviews,
            AVG(rm.quality_score)                AS avg_quality,
            AVG(rm.security_score)               AS avg_security,
            AVG(rv.execution_time)               AS avg_review_time
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        LEFT JOIN review_metrics rm ON rm.review_id = rv.id
        WHERE {where}
          AND rv.created_at >= date('now', '-84 days')
        GROUP BY strftime('%Y-W%W', rv.created_at)
        ORDER BY date ASC
        """,
        tuple(params),
    )

    # Monthly — last 12 months (YYYY-MM)
    monthly_rows = await fetchall(
        f"""
        SELECT
            strftime('%Y-%m', rv.created_at)    AS date,
            COUNT(rv.id)                         AS reviews,
            AVG(rm.quality_score)                AS avg_quality,
            AVG(rm.security_score)               AS avg_security,
            AVG(rv.execution_time)               AS avg_review_time
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        LEFT JOIN review_metrics rm ON rm.review_id = rv.id
        WHERE {where}
          AND rv.created_at >= date('now', '-365 days')
        GROUP BY strftime('%Y-%m', rv.created_at)
        ORDER BY date ASC
        """,
        tuple(params),
    )

    def _to_points(rows: list[dict]) -> list[TrendDataPoint]:
        return [
            TrendDataPoint(
                date=row["date"],
                reviews=row["reviews"] or 0,
                avg_quality=_safe_float(row.get("avg_quality")),
                avg_security=_safe_float(row.get("avg_security")),
                avg_review_time=_safe_float(row.get("avg_review_time")),
            )
            for row in rows
        ]

    return TrendAnalytics(
        daily=_to_points(daily_rows),
        weekly=_to_points(weekly_rows),
        monthly=_to_points(monthly_rows),
    )


# ── Model analytics ───────────────────────────────────────────────────────────

async def get_model_analytics(
    user_id: int,
    repo: str | None = None,
    tool: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> ModelAnalyticsList:
    """Return per-model usage statistics."""
    where, params = _build_filters(
        user_id, repo=repo, tool=tool, model=None,
        date_from=date_from, date_to=date_to,
    )

    total_row = await fetchone(
        f"""
        SELECT COUNT(*) AS cnt
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        WHERE {where}
        """,
        tuple(params),
    )
    total = (total_row or {}).get("cnt") or 0

    rows = await fetchall(
        f"""
        SELECT
            COALESCE(rv.llm_model, 'unknown')   AS model_name,
            COUNT(rv.id)                         AS review_count,
            AVG(rv.execution_time)               AS avg_response_time,
            AVG(rv.tokens_used)                  AS avg_tokens
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        WHERE {where}
        GROUP BY COALESCE(rv.llm_model, 'unknown')
        ORDER BY review_count DESC
        """,
        tuple(params),
    )

    items = [
        ModelAnalytics(
            model_name=row["model_name"],
            review_count=row["review_count"] or 0,
            avg_response_time=round(float(row.get("avg_response_time") or 0), 2),
            avg_tokens=_safe_float(row.get("avg_tokens"), 0),
            pct_of_total=round(
                (row["review_count"] / total * 100) if total > 0 else 0.0, 1
            ),
        )
        for row in rows
    ]
    return ModelAnalyticsList(items=items, total_reviews=total)


# ── Security analytics ────────────────────────────────────────────────────────

async def get_security_analytics(
    user_id: int,
    repo: str | None = None,
    tool: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> SecurityAnalytics:
    """Return security-focused aggregate data."""
    where, params = _build_filters(
        user_id, repo=repo, tool=tool, model=None,
        date_from=date_from, date_to=date_to,
    )

    agg = await fetchone(
        f"""
        SELECT
            AVG(rm.security_score)                      AS avg_security_score,
            SUM(COALESCE(rm.bugs_found, 0))             AS total_bugs_found,
            COUNT(CASE WHEN COALESCE(rm.bugs_found,0) > 0 THEN 1 END)  AS reviews_with_bugs,
            COUNT(rv.id)                                AS total_reviews
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        LEFT JOIN review_metrics rm ON rm.review_id = rv.id
        WHERE {where}
        """,
        tuple(params),
    )
    agg = agg or {}
    total = agg.get("total_reviews") or 0
    with_bugs = agg.get("reviews_with_bugs") or 0

    # Score distribution in 5 buckets of 20 points each
    buckets = [
        ("0-20", "rm.security_score BETWEEN 0 AND 20"),
        ("21-40", "rm.security_score BETWEEN 21 AND 40"),
        ("41-60", "rm.security_score BETWEEN 41 AND 60"),
        ("61-80", "rm.security_score BETWEEN 61 AND 80"),
        ("81-100", "rm.security_score BETWEEN 81 AND 100"),
    ]
    distribution = []
    for label, cond in buckets:
        row = await fetchone(
            f"""
            SELECT COUNT(*) AS cnt
            FROM reviews rv
            JOIN pull_requests pr ON pr.id = rv.pull_request_id
            JOIN repositories  r  ON r.id  = pr.repository_id
            LEFT JOIN review_metrics rm ON rm.review_id = rv.id
            WHERE {where} AND {cond}
            """,
            tuple(params),
        )
        distribution.append({"range": label, "count": (row or {}).get("cnt") or 0})

    # Top repos by total bugs
    top_rows = await fetchall(
        f"""
        SELECT
            r.github_owner || '/' || r.github_repo  AS repo,
            SUM(COALESCE(rm.bugs_found, 0))         AS bugs
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        LEFT JOIN review_metrics rm ON rm.review_id = rv.id
        WHERE {where}
        GROUP BY r.id
        ORDER BY bugs DESC
        LIMIT 5
        """,
        tuple(params),
    )

    return SecurityAnalytics(
        avg_security_score=_safe_float(agg.get("avg_security_score")),
        total_bugs_found=int(agg.get("total_bugs_found") or 0),
        reviews_with_bugs=with_bugs,
        pct_reviews_with_bugs=round((with_bugs / total * 100) if total > 0 else 0.0, 1),
        score_distribution=distribution,
        top_repos_by_bugs=[{"repo": r["repo"], "bugs": int(r["bugs"] or 0)} for r in top_rows],
    )


# ── Performance analytics ─────────────────────────────────────────────────────

async def get_performance_analytics(
    user_id: int,
    repo: str | None = None,
    tool: str | None = None,
    model: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> PerformanceAnalytics:
    """Return execution-time statistics."""
    where, params = _build_filters(user_id, repo, tool, model, date_from, date_to)

    agg = await fetchone(
        f"""
        SELECT
            MIN(rv.execution_time)   AS fastest_review,
            MAX(rv.execution_time)   AS slowest_review,
            AVG(rv.execution_time)   AS avg_review_time,
            SUM(rv.execution_time)   AS total_ai_processing_time
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        WHERE {where}
        """,
        tuple(params),
    )
    agg = agg or {}

    # p95 — fetch all execution times and compute in Python
    # (SQLite has no PERCENTILE_CONT function)
    time_rows = await fetchall(
        f"""
        SELECT rv.execution_time
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        WHERE {where}
        ORDER BY rv.execution_time ASC
        """,
        tuple(params),
    )
    times = [r["execution_time"] for r in time_rows if r["execution_time"] is not None]
    p95 = 0.0
    if times:
        idx = max(0, int(len(times) * 0.95) - 1)
        p95 = round(times[idx], 2)

    # Per-tool breakdown
    tool_rows = await fetchall(
        f"""
        SELECT
            rv.tool,
            COUNT(*)             AS cnt,
            AVG(rv.execution_time) AS avg_time
        FROM reviews rv
        JOIN pull_requests pr ON pr.id = rv.pull_request_id
        JOIN repositories  r  ON r.id  = pr.repository_id
        WHERE {where}
        GROUP BY rv.tool
        ORDER BY avg_time DESC
        """,
        tuple(params),
    )

    return PerformanceAnalytics(
        fastest_review=round(float(agg.get("fastest_review") or 0), 2),
        slowest_review=round(float(agg.get("slowest_review") or 0), 2),
        avg_review_time=round(float(agg.get("avg_review_time") or 0), 2),
        p95_review_time=p95,
        total_ai_processing_time=round(float(agg.get("total_ai_processing_time") or 0), 2),
        time_by_tool=[
            {"tool": r["tool"], "avg_time": round(float(r["avg_time"] or 0), 2), "count": r["cnt"]}
            for r in tool_rows
        ],
    )
