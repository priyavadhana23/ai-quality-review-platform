"""
Enterprise Report Generator service.

Orchestration layer — reads persisted data from all existing modules and
assembles a unified report.  No AI engine calls are made here.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Any

from app.core.logger import get_logger
from app.db.database import execute, fetchall, fetchone
from app.schemas.reports import (
    AnalyticsSection,
    ApiQualitySection,
    EngineeringHealthScore,
    GeneratedReport,
    PaginatedReportList,
    ReportGenerateRequest,
    ReportListItem,
    ReportPayload,
    REPORT_TYPE_LABELS,
    ReviewSummarySection,
    SecuritySection,
    TestGeneratorSection,
)


def _f(v: Any) -> float | None:
    try:
        return round(float(v), 2) if v is not None else None
    except Exception:
        return None


async def _collect_reviews(user_id: int, repo: str | None,
                           date_from: str | None, date_to: str | None) -> ReviewSummarySection:
    conds = ["r.user_id = ?"]
    params: list[Any] = [user_id]
    if repo:
        conds.append("(r.github_owner || '/' || r.github_repo) = ?")
        params.append(repo)
    if date_from:
        conds.append("rv.created_at >= ?")
        params.append(date_from)
    if date_to:
        conds.append("rv.created_at <= ?")
        params.append(date_to + " 23:59:59")
    where = " AND ".join(conds)
    agg = await fetchone(
        f"SELECT COUNT(rv.id) AS cnt, AVG(rm.quality_score) AS avg_q,"
        f" AVG(rm.security_score) AS avg_s, AVG(COALESCE(rm.bugs_found,0)) AS avg_b,"
        f" AVG(COALESCE(rm.suggestions,0)) AS avg_sg, AVG(rv.execution_time) AS avg_t"
        f" FROM reviews rv JOIN pull_requests pr ON pr.id=rv.pull_request_id"
        f" JOIN repositories r ON r.id=pr.repository_id"
        f" LEFT JOIN review_metrics rm ON rm.review_id=rv.id WHERE {where}",
        tuple(params))
    tool_rows = await fetchall(
        f"SELECT rv.tool, COUNT(*) AS cnt FROM reviews rv"
        f" JOIN pull_requests pr ON pr.id=rv.pull_request_id"
        f" JOIN repositories r ON r.id=pr.repository_id"
        f" WHERE {where} GROUP BY rv.tool", tuple(params))
    recent = await fetchall(
        f"SELECT rv.id, rv.tool, rv.created_at, rv.execution_time, pr.pr_url, pr.pr_number,"
        f" r.github_owner, r.github_repo, rm.quality_score, rm.security_score, rm.bugs_found"
        f" FROM reviews rv JOIN pull_requests pr ON pr.id=rv.pull_request_id"
        f" JOIN repositories r ON r.id=pr.repository_id"
        f" LEFT JOIN review_metrics rm ON rm.review_id=rv.id"
        f" WHERE {where} ORDER BY rv.created_at DESC LIMIT 5", tuple(params))
    agg = agg or {}
    return ReviewSummarySection(
        total_reviews=agg.get("cnt") or 0,
        tools_used={r["tool"]: r["cnt"] for r in tool_rows},
        avg_quality_score=_f(agg.get("avg_q")),
        avg_security_score=_f(agg.get("avg_s")),
        avg_bugs_found=round(float(agg.get("avg_b") or 0), 2),
        avg_suggestions=round(float(agg.get("avg_sg") or 0), 2),
        avg_execution_time=round(float(agg.get("avg_t") or 0), 2),
        recent_reviews=[dict(r) for r in recent],
    )


async def _collect_security(user_id: int,
                             date_from: str | None, date_to: str | None) -> SecuritySection:
    conds = ["user_id = ?"]
    params: list[Any] = [user_id]
    if date_from:
        conds.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        conds.append("created_at <= ?")
        params.append(date_to + " 23:59:59")
    where = " AND ".join(conds)
    agg = await fetchone(
        f"SELECT COUNT(*) AS cnt, AVG(overall_security_score) AS avg_s,"
        f" SUM(critical_count) AS tot_c, SUM(high_count) AS tot_h,"
        f" SUM(medium_count) AS tot_m, SUM(low_count) AS tot_l"
        f" FROM security_scan_reports WHERE {where}", tuple(params))
    recent = await fetchall(
        f"SELECT id, repository, scan_type, overall_security_score,"
        f" critical_count, high_count, medium_count, low_count, created_at"
        f" FROM security_scan_reports WHERE {where}"
        f" ORDER BY created_at DESC LIMIT 5", tuple(params))
    all_scans = await fetchall(
        f"SELECT scan_report_json FROM security_scan_reports WHERE {where}", tuple(params))
    owasp: dict[str, int] = {}
    cwe: dict[str, int] = {}
    for row in all_scans:
        try:
            d = json.loads(row.get("scan_report_json") or "{}")
            for c in d.get("owasp_categories_found") or []:
                owasp[c] = owasp.get(c, 0) + 1
            for c in d.get("cwe_ids_found") or []:
                cwe[c] = cwe.get(c, 0) + 1
        except Exception:
            pass
    agg = agg or {}
    return SecuritySection(
        total_scans=agg.get("cnt") or 0,
        avg_security_score=_f(agg.get("avg_s")),
        total_critical=int(agg.get("tot_c") or 0),
        total_high=int(agg.get("tot_h") or 0),
        total_medium=int(agg.get("tot_m") or 0),
        total_low=int(agg.get("tot_l") or 0),
        top_owasp_categories=[k for k, _ in sorted(owasp.items(), key=lambda x: -x[1])[:5]],
        top_cwe_ids=[k for k, _ in sorted(cwe.items(), key=lambda x: -x[1])[:5]],
        recent_scans=[dict(r) for r in recent],
    )


async def _collect_api_quality(user_id: int,
                                date_from: str | None, date_to: str | None) -> ApiQualitySection:
    conds = ["user_id = ?"]
    params: list[Any] = [user_id]
    if date_from:
        conds.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        conds.append("created_at <= ?")
        params.append(date_to + " 23:59:59")
    where = " AND ".join(conds)
    agg = await fetchone(
        f"SELECT COUNT(*) AS cnt, AVG(quality_score) AS avg_q, AVG(security_score) AS avg_s,"
        f" AVG(documentation_score) AS avg_d, AVG(design_score) AS avg_de,"
        f" AVG(validation_score) AS avg_v, SUM(total_endpoints) AS tot_ep"
        f" FROM api_quality_reports WHERE {where}", tuple(params))
    recent = await fetchall(
        f"SELECT id, filename, api_title, spec_version, quality_score,"
        f" security_score, total_endpoints, created_at"
        f" FROM api_quality_reports WHERE {where}"
        f" ORDER BY created_at DESC LIMIT 5", tuple(params))
    agg = agg or {}
    return ApiQualitySection(
        total_reports=agg.get("cnt") or 0,
        avg_quality_score=_f(agg.get("avg_q")),
        avg_security_score=_f(agg.get("avg_s")),
        avg_documentation_score=_f(agg.get("avg_d")),
        avg_design_score=_f(agg.get("avg_de")),
        avg_validation_score=_f(agg.get("avg_v")),
        total_endpoints_analysed=int(agg.get("tot_ep") or 0),
        recent_reports=[dict(r) for r in recent],
    )


async def _collect_tests(user_id: int,
                          date_from: str | None, date_to: str | None) -> TestGeneratorSection:
    conds = ["user_id = ?"]
    params: list[Any] = [user_id]
    if date_from:
        conds.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        conds.append("created_at <= ?")
        params.append(date_to + " 23:59:59")
    where = " AND ".join(conds)
    agg = await fetchone(
        f"SELECT COUNT(*) AS cnt, AVG(coverage_score) AS avg_c, AVG(confidence_score) AS avg_cf"
        f" FROM generated_tests WHERE {where}", tuple(params))
    lang_rows = await fetchall(
        f"SELECT language, COUNT(*) AS cnt FROM generated_tests WHERE {where} GROUP BY language",
        tuple(params))
    fw_rows = await fetchall(
        f"SELECT framework, COUNT(*) AS cnt FROM generated_tests WHERE {where} GROUP BY framework",
        tuple(params))
    recent = await fetchall(
        f"SELECT id, pr_url, language, framework, test_type, coverage_score, confidence_score, created_at"
        f" FROM generated_tests WHERE {where} ORDER BY created_at DESC LIMIT 5", tuple(params))
    agg = agg or {}
    return TestGeneratorSection(
        total_generated=agg.get("cnt") or 0,
        languages_used={r["language"]: r["cnt"] for r in lang_rows},
        frameworks_used={r["framework"]: r["cnt"] for r in fw_rows},
        avg_coverage_score=_f(agg.get("avg_c")),
        avg_confidence_score=_f(agg.get("avg_cf")),
        recent_tests=[dict(r) for r in recent],
    )


async def _collect_analytics(user_id: int, repo: str | None,
                              date_from: str | None, date_to: str | None) -> AnalyticsSection:
    from app.services.analytics_service import get_overview, get_repository_analytics
    overview = await get_overview(user_id, repo=repo, date_from=date_from, date_to=date_to)
    repo_data = await get_repository_analytics(user_id, date_from=date_from, date_to=date_to)
    top_repos = [
        {"repo": r.repo_label, "reviews": r.review_count, "avg_quality": r.avg_quality_score}
        for r in (repo_data.items if hasattr(repo_data, "items") else [])[:5]
    ]
    return AnalyticsSection(
        repositories_analysed=getattr(overview, "repositories_analysed", 0),
        pull_requests_reviewed=getattr(overview, "pull_requests_reviewed", 0),
        most_used_model=getattr(overview, "most_used_model", None),
        avg_review_time=getattr(overview, "avg_review_time", 0.0),
        top_repositories=top_repos,
    )


def _compute_health(reviews: ReviewSummarySection | None, security: SecuritySection | None,
                    api_quality: ApiQualitySection | None,
                    tests: TestGeneratorSection | None) -> EngineeringHealthScore:
    scores: list[float] = []
    review_score: float | None = None
    if reviews and reviews.total_reviews > 0:
        q = reviews.avg_quality_score or 0.0
        s = reviews.avg_security_score or 0.0
        if q or s:
            review_score = round((q + s) / 2, 1)
            scores.append(review_score)
    sec_score: float | None = None
    if security and security.total_scans > 0 and security.avg_security_score is not None:
        sec_score = security.avg_security_score
        scores.append(sec_score)
    api_score: float | None = None
    if api_quality and api_quality.total_reports > 0 and api_quality.avg_quality_score is not None:
        api_score = api_quality.avg_quality_score
        scores.append(api_score)
    test_score: float | None = None
    if tests and tests.total_generated > 0 and tests.avg_coverage_score is not None:
        test_score = tests.avg_coverage_score
        scores.append(test_score)
    overall = round(sum(scores) / len(scores), 1) if scores else None
    parts: list[str] = []
    if overall is not None:
        if overall >= 80:
            parts.append("Platform health is strong.")
        elif overall >= 60:
            parts.append("Platform health is moderate — room for improvement.")
        else:
            parts.append("Platform health needs attention.")
    if security and security.total_critical > 0:
        parts.append(f"{security.total_critical} critical security issue(s) require immediate attention.")
    if api_quality and api_quality.avg_documentation_score is not None \
            and api_quality.avg_documentation_score < 60:
        parts.append("API documentation quality is below threshold.")
    if tests and tests.avg_coverage_score is not None and tests.avg_coverage_score < 60:
        parts.append("Test coverage could be improved.")
    return EngineeringHealthScore(
        overall=overall, review_coverage=review_score, security_posture=sec_score,
        api_quality=api_score, test_coverage=test_score, explanation=" ".join(parts),
    )


def _build_recommendations(reviews: ReviewSummarySection | None, security: SecuritySection | None,
                            api_quality: ApiQualitySection | None,
                            tests: TestGeneratorSection | None) -> list[str]:
    recs: list[str] = []
    if security and security.total_critical > 0:
        recs.append(f"Address {security.total_critical} critical security finding(s) immediately.")
    if security and security.total_high > 0:
        recs.append(f"Remediate {security.total_high} high-severity issue(s) in the next sprint.")
    if reviews and reviews.avg_quality_score is not None and reviews.avg_quality_score < 60:
        recs.append("Code quality scores are below 60 — schedule a quality improvement sprint.")
    if api_quality and api_quality.avg_documentation_score is not None \
            and api_quality.avg_documentation_score < 60:
        recs.append("Improve API documentation coverage — target 80+ documentation score.")
    if tests and tests.avg_coverage_score is not None and tests.avg_coverage_score < 70:
        recs.append("Increase test coverage — current average is below 70%.")
    if not recs:
        recs.append("Continue current practices — all metrics are within acceptable thresholds.")
    return recs


def _sc(v: float | None) -> str:
    return f"{v:.0f}/100" if v is not None else "—"


def _render_markdown(title: str, payload: ReportPayload) -> str:
    h = payload.engineering_health
    lines = [
        f"# {title}",
        f"\n**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"**Report Type:** {REPORT_TYPE_LABELS.get(payload.report_type, payload.report_type)}",
    ]
    if payload.repository:
        lines.append(f"**Repository:** `{payload.repository}`")
    if payload.pull_request:
        lines.append(f"**Pull Request:** {payload.pull_request}")
    if payload.date_from or payload.date_to:
        lines.append(f"**Period:** {payload.date_from or '—'} → {payload.date_to or 'now'}")
    lines += [
        "\n## Engineering Health Score",
        "| Dimension | Score |", "|-----------|-------|",
        f"| **Overall** | {_sc(h.overall)} |",
        f"| Review Coverage | {_sc(h.review_coverage)} |",
        f"| Security Posture | {_sc(h.security_posture)} |",
        f"| API Quality | {_sc(h.api_quality)} |",
        f"| Test Coverage | {_sc(h.test_coverage)} |",
    ]
    if h.explanation:
        lines.append(f"\n> {h.explanation}")
    if payload.reviews:
        r = payload.reviews
        lines += ["\n## PR Review Summary", f"- **Total Reviews:** {r.total_reviews}"]
        if r.tools_used:
            lines.append(f"- **Tools:** {', '.join(f'{k}: {v}' for k, v in r.tools_used.items())}")
        if r.avg_quality_score is not None:
            lines.append(f"- **Avg Quality:** {r.avg_quality_score:.0f}/100")
        if r.avg_security_score is not None:
            lines.append(f"- **Avg Security:** {r.avg_security_score:.0f}/100")
        lines += [f"- **Avg Bugs Found:** {r.avg_bugs_found:.1f}",
                  f"- **Avg Suggestions:** {r.avg_suggestions:.1f}"]
    if payload.security:
        s = payload.security
        lines += ["\n## Security Summary", f"- **Total Scans:** {s.total_scans}"]
        if s.avg_security_score is not None:
            lines.append(f"- **Avg Security Score:** {s.avg_security_score:.0f}/100")
        lines.append(f"- Critical: **{s.total_critical}** | High: **{s.total_high}**"
                     f" | Medium: **{s.total_medium}** | Low: **{s.total_low}**")
        if s.top_owasp_categories:
            lines.append(f"- **Top OWASP:** {', '.join(s.top_owasp_categories[:3])}")
    if payload.api_quality:
        a = payload.api_quality
        lines += ["\n## API Quality Summary",
                  f"- **Reports:** {a.total_reports}",
                  f"- **Total Endpoints:** {a.total_endpoints_analysed}"]
        for label, val in [("Quality", a.avg_quality_score), ("Security", a.avg_security_score),
                            ("Documentation", a.avg_documentation_score)]:
            if val is not None:
                lines.append(f"- **Avg {label}:** {val:.0f}/100")
    if payload.tests:
        t = payload.tests
        lines += ["\n## Test Generation Summary", f"- **Tests Generated:** {t.total_generated}"]
        if t.avg_coverage_score is not None:
            lines.append(f"- **Avg Coverage:** {t.avg_coverage_score:.0f}%")
        if t.languages_used:
            lines.append(f"- **Languages:** {', '.join(t.languages_used.keys())}")
    if payload.analytics:
        an = payload.analytics
        lines += ["\n## Analytics Overview",
                  f"- **Repositories:** {an.repositories_analysed}",
                  f"- **PRs Reviewed:** {an.pull_requests_reviewed}"]
        if an.most_used_model:
            lines.append(f"- **Most Used Model:** {an.most_used_model}")
    if payload.recommendations:
        lines.append("\n## Recommendations")
        for i, rec in enumerate(payload.recommendations, 1):
            lines.append(f"{i}. {rec}")
    return "\n".join(lines)


def _render_html(title: str, payload: ReportPayload) -> str:
    md = _render_markdown(title, payload)

    def _line(ln: str) -> str:
        s = ln.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if s.startswith("# "):
            return f"<h1>{s[2:]}</h1>"
        if s.startswith("## "):
            return f"<h2>{s[3:]}</h2>"
        if s.startswith("- "):
            return f"<li>{s[2:]}</li>"
        if s.startswith("> "):
            return f"<blockquote>{s[2:]}</blockquote>"
        if s.startswith("|") and "---" in s:
            return ""
        if s.startswith("|"):
            cells = [c.strip() for c in s.split("|") if c.strip()]
            tag = "th" if any(c.startswith("**") for c in cells) else "td"
            return f"<tr>{''.join(f'<{tag}>{c}</{tag}>' for c in cells)}</tr>"
        return f"<p>{s}</p>" if s.strip() else ""

    body = "\n".join(_line(ln) for ln in md.splitlines())
    css = ("body{font-family:-apple-system,sans-serif;max-width:960px;margin:40px auto;"
           "padding:0 20px;color:#24292e;line-height:1.6}"
           "h1{border-bottom:2px solid #0366d6;color:#0366d6}"
           "h2{border-bottom:1px solid #e1e4e8;margin-top:32px}"
           "table{border-collapse:collapse;width:100%}"
           "th,td{border:1px solid #e1e4e8;padding:8px 12px;text-align:left}"
           "th{background:#f6f8fa}"
           "blockquote{border-left:4px solid #0366d6;margin:0;padding:8px 16px;background:#f0f7ff}"
           "@media(prefers-color-scheme:dark){"
           "body{background:#0d1117;color:#c9d1d9}h1{color:#58a6ff;border-color:#58a6ff}"
           "h2{border-color:#30363d}th{background:#161b22}th,td{border-color:#30363d}"
           "blockquote{background:#0d2438;border-color:#58a6ff}}")
    t = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{t}</title><style>{css}</style></head><body>{body}</body></html>")


_TYPE_MODULES: dict[str, set[str]] = {
    "executive": {"reviews", "security", "api_quality", "analytics"},
    "developer": {"reviews", "tests", "analytics"},
    "qa": {"reviews", "tests"},
    "security": {"security"},
    "api_quality": {"api_quality"},
    "full": {"reviews", "security", "api_quality", "tests", "analytics"},
}


async def generate_report(user_id: int, req: ReportGenerateRequest) -> GeneratedReport:
    logger = get_logger()
    modules = set(req.modules) if req.modules else _TYPE_MODULES.get(
        req.report_type, {"reviews", "security", "api_quality", "tests", "analytics"})

    reviews = await _collect_reviews(user_id, req.repository, req.date_from, req.date_to) \
        if "reviews" in modules else None
    security = await _collect_security(user_id, req.date_from, req.date_to) \
        if "security" in modules else None
    api_quality = await _collect_api_quality(user_id, req.date_from, req.date_to) \
        if "api_quality" in modules else None
    tests = await _collect_tests(user_id, req.date_from, req.date_to) \
        if "tests" in modules else None
    analytics = await _collect_analytics(user_id, req.repository, req.date_from, req.date_to) \
        if "analytics" in modules else None

    health = _compute_health(reviews, security, api_quality, tests)
    recommendations = _build_recommendations(reviews, security, api_quality, tests)
    title = (req.report_title or
             f"{REPORT_TYPE_LABELS.get(req.report_type, 'Report')} — "
             f"{req.repository or 'All Repositories'}")

    payload = ReportPayload(
        report_type=req.report_type, repository=req.repository,
        pull_request=req.pull_request, date_from=req.date_from, date_to=req.date_to,
        modules_included=sorted(modules), engineering_health=health,
        reviews=reviews, security=security, api_quality=api_quality,
        tests=tests, analytics=analytics, recommendations=recommendations,
    )

    if req.report_format == "html":
        content = _render_html(title, payload)
    elif req.report_format == "json":
        content = payload.model_dump_json(indent=2)
    else:
        content = _render_markdown(title, payload)

    summary = health.explanation or f"{REPORT_TYPE_LABELS.get(req.report_type, 'Report')} generated."
    row_id = await execute(
        "INSERT INTO generated_reports"
        " (user_id, repository, pull_request, report_type, report_format,"
        "  report_title, summary, report_content)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, req.repository, req.pull_request,
         req.report_type, req.report_format, title, summary, content),
    )
    row = await fetchone("SELECT * FROM generated_reports WHERE id = ?", (row_id,))
    logger.info(f"Report generated: id={row_id} type={req.report_type} fmt={req.report_format}")
    report = GeneratedReport.from_db(row, include_payload=False)  # type: ignore[arg-type]
    report.report_content = content
    report.payload = payload
    return report


async def list_reports(user_id: int, page: int = 1, page_size: int = 20,
                       report_type: str | None = None) -> PaginatedReportList:
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    conds = ["user_id = ?"]
    params: list[Any] = [user_id]
    if report_type:
        conds.append("report_type = ?")
        params.append(report_type)
    where = " AND ".join(conds)
    count_row = await fetchone(
        f"SELECT COUNT(*) AS cnt FROM generated_reports WHERE {where}", tuple(params))
    total = (count_row or {}).get("cnt") or 0
    rows = await fetchall(
        f"SELECT id, user_id, repository, pull_request, report_type, report_format,"
        f" report_title, summary, generated_at"
        f" FROM generated_reports WHERE {where}"
        f" ORDER BY generated_at DESC LIMIT ? OFFSET ?",
        tuple(params) + (page_size, (page - 1) * page_size),
    )
    return PaginatedReportList(
        items=[ReportListItem.from_db(r) for r in rows],
        total=total, page=page, page_size=page_size,
        total_pages=max(math.ceil(total / page_size), 1),
    )


async def get_report(report_id: int, user_id: int) -> GeneratedReport | None:
    row = await fetchone(
        "SELECT * FROM generated_reports WHERE id = ? AND user_id = ?", (report_id, user_id))
    return GeneratedReport.from_db(row) if row else None  # type: ignore[arg-type]


async def delete_report(report_id: int, user_id: int) -> bool:
    row = await fetchone(
        "SELECT id FROM generated_reports WHERE id = ? AND user_id = ?", (report_id, user_id))
    if not row:
        return False
    await execute("DELETE FROM generated_reports WHERE id = ?", (report_id,))
    return True
