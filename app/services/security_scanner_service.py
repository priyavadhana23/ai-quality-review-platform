"""
AI Security Scanner service.

Reuses the existing PR-Agent / Gemini / LiteLLM pipeline via
BasePRAgentService._invoke_engine — the same path used by every other tool.

For PR scans the pr_url is passed directly to the engine as the context, then
a detailed security-analysis prompt is sent as the ``ask`` question (identical
to how test_generator_service and api_quality_service work).

For ZIP/file scans the content is embedded directly in the prompt alongside a
placeholder PR URL — identical to how api_quality_service handles spec files.

Flow
----
1. Build a structured security-analysis prompt.
2. Call _invoke_engine("ask", [prompt]).
3. Parse the JSON response into SecurityAnalysis.
4. Count findings by severity.
5. Persist to security_scan_reports.
6. Return SecurityScanReport.
"""
from __future__ import annotations

import json
import math
import re
from typing import Any

from app.core.logger import get_logger
from app.db.database import execute, fetchall, fetchone
from app.schemas.security_scanner import (
    PaginatedScanList,
    RiskDistribution,
    SecurityAnalysis,
    SecurityChecklistItem,
    SecurityFinding,
    SecurityScanListItem,
    SecurityScanReport,
)
from app.services.base_service import BasePRAgentService

# Public placeholder PR used when the engine needs a PR URL but we are scanning
# uploaded content.  Same pattern as api_quality_service.
_PLACEHOLDER_PR_URL = "https://github.com/Codium-ai/pr-agent/pull/1"

# Max characters of source content to embed in the prompt to stay within tokens.
_MAX_CONTENT_CHARS = 14_000


# ── Engine bridge ─────────────────────────────────────────────────────────────

class _AskBridge(BasePRAgentService):
    tool_name: str = "ask"


_bridge = _AskBridge()


# ── Prompt builders ───────────────────────────────────────────────────────────

_SECURITY_CATEGORIES = """
- Hardcoded secrets / API keys / passwords
- SQL Injection (CWE-89)
- Command Injection (CWE-78)
- Path Traversal (CWE-22)
- Cross-Site Scripting / XSS (CWE-79)
- CSRF (CWE-352)
- SSRF (CWE-918)
- Broken Authentication (CWE-287)
- Authorization / Privilege Escalation (CWE-285)
- Sensitive Data Exposure (CWE-200)
- Unsafe Deserialization (CWE-502)
- Dependency Risks / Known Vulnerable Components
- Logging Sensitive Data (CWE-532)
- Input Validation Problems (CWE-20)
- Unsafe Cryptography (CWE-327)
- Race Conditions (CWE-362)
- Insecure Direct Object Reference
- Security Misconfiguration
"""

_JSON_SCHEMA = """\
{
  "executive_summary": "<2-4 sentence overview>",
  "overall_security_score": <0-100, higher is more secure>,
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "owasp_category": "<OWASP Top 10 category string>",
      "cwe_id": "CWE-<number>",
      "title": "<short title>",
      "description": "<what the issue is>",
      "affected_file": "<filename or path, empty string if unknown>",
      "affected_function": "<function/method name, empty string if unknown>",
      "confidence": <0-100>,
      "risk_explanation": "<why this is dangerous>",
      "recommendation": "<how to fix it>",
      "secure_code_example": "<short corrected code snippet, empty string if not applicable>"
    }
  ],
  "top_risks": ["<risk 1>", "<risk 2>"],
  "recommendations": ["<rec 1>", "<rec 2>"],
  "owasp_categories_found": ["<category>"],
  "cwe_ids_found": ["CWE-89"],
  "secure_coding_checklist": [
    {"category": "<category>", "item": "<what to check>", "status": "check|warning|fail"}
  ]
}"""


def _build_pr_prompt() -> str:
    """Prompt for PR-context scan — engine fetches diff itself."""
    return (
        "You are an expert security engineer. Perform a comprehensive security analysis "
        "of all code changes in this pull request.\n\n"
        f"Check for every one of the following vulnerability categories:\n{_SECURITY_CATEGORIES}\n\n"
        "For each finding provide severity, OWASP mapping, CWE ID, affected file/function, "
        "confidence score, risk explanation, recommendation, and a secure code example.\n\n"
        "Return ONLY a JSON object matching EXACTLY this structure "
        "(use empty arrays/strings for missing data, never omit keys):\n"
        f"{_JSON_SCHEMA}\n\n"
        "Return ONLY the JSON — no markdown fences, no extra text."
    )


def _build_content_prompt(content: str, filename: str) -> str:
    """Prompt for uploaded content scan — embeds the source text."""
    truncated = content[:_MAX_CONTENT_CHARS]
    if len(content) > _MAX_CONTENT_CHARS:
        truncated += "\n\n[... content truncated for length ...]"

    return (
        "You are an expert security engineer. Perform a comprehensive security analysis "
        f"of the following source code (filename: {filename}).\n\n"
        f"Check for every one of the following vulnerability categories:\n{_SECURITY_CATEGORIES}\n\n"
        "For each finding provide severity, OWASP mapping, CWE ID, affected file/function, "
        "confidence score, risk explanation, recommendation, and a secure code example.\n\n"
        "Return ONLY a JSON object matching EXACTLY this structure "
        "(use empty arrays/strings for missing data, never omit keys):\n"
        f"{_JSON_SCHEMA}\n\n"
        "Return ONLY the JSON — no markdown fences, no extra text.\n\n"
        f"=== SOURCE CODE ===\n{truncated}"
    )


# ── Response parser ───────────────────────────────────────────────────────────

def _parse_analysis(raw_text: str) -> SecurityAnalysis:
    """Extract and validate the JSON from the AI response."""
    text = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text.strip())

    brace = re.search(r"\{.*\}", text, re.DOTALL)
    if brace:
        text = brace.group(0)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return SecurityAnalysis(executive_summary=raw_text[:500])

    def _score(v: Any) -> float | None:
        try:
            return min(100.0, max(0.0, float(v))) if v is not None else None
        except Exception:
            return None

    def _findings(lst: list[Any]) -> list[SecurityFinding]:
        out = []
        for item in (lst or []):
            if not isinstance(item, dict):
                continue
            try:
                sev = str(item.get("severity") or "low").lower()
                if sev not in ("critical", "high", "medium", "low"):
                    sev = "low"
                conf_raw = item.get("confidence", 0)
                try:
                    conf = min(100.0, max(0.0, float(conf_raw)))
                except Exception:
                    conf = 0.0
                out.append(SecurityFinding(
                    severity=sev,
                    owasp_category=str(item.get("owasp_category") or ""),
                    cwe_id=str(item.get("cwe_id") or ""),
                    title=str(item.get("title") or ""),
                    description=str(item.get("description") or ""),
                    affected_file=str(item.get("affected_file") or ""),
                    affected_function=str(item.get("affected_function") or ""),
                    confidence=conf,
                    risk_explanation=str(item.get("risk_explanation") or ""),
                    recommendation=str(item.get("recommendation") or ""),
                    secure_code_example=str(item.get("secure_code_example") or ""),
                ))
            except Exception:
                pass
        return out

    def _checklist(lst: list[Any]) -> list[SecurityChecklistItem]:
        out = []
        for item in (lst or []):
            if not isinstance(item, dict):
                continue
            try:
                status = str(item.get("status") or "check").lower()
                if status not in ("check", "warning", "fail"):
                    status = "check"
                out.append(SecurityChecklistItem(
                    category=str(item.get("category") or ""),
                    item=str(item.get("item") or ""),
                    status=status,
                ))
            except Exception:
                pass
        return out

    findings = _findings(data.get("findings") or [])

    dist = RiskDistribution(
        critical=sum(1 for f in findings if f.severity == "critical"),
        high=sum(1 for f in findings if f.severity == "high"),
        medium=sum(1 for f in findings if f.severity == "medium"),
        low=sum(1 for f in findings if f.severity == "low"),
    )

    return SecurityAnalysis(
        executive_summary=str(data.get("executive_summary") or ""),
        overall_security_score=_score(data.get("overall_security_score")),
        risk_distribution=dist,
        findings=findings,
        top_risks=[str(r) for r in (data.get("top_risks") or [])],
        recommendations=[str(r) for r in (data.get("recommendations") or [])],
        owasp_categories_found=[str(c) for c in (data.get("owasp_categories_found") or [])],
        cwe_ids_found=[str(c) for c in (data.get("cwe_ids_found") or [])],
        secure_coding_checklist=_checklist(data.get("secure_coding_checklist") or []),
    )


# ── Database helper ───────────────────────────────────────────────────────────

async def _save_report(
    user_id: int,
    scan_type: str,
    repository: str | None,
    branch: str | None,
    commit_sha: str | None,
    analysis: SecurityAnalysis,
    llm_model: str | None,
    execution_time: float,
) -> dict[str, Any]:
    d = analysis.risk_distribution
    row_id = await execute(
        """
        INSERT INTO security_scan_reports
            (user_id, scan_type, repository, branch, commit_sha,
             overall_security_score, critical_count, high_count,
             medium_count, low_count, owasp_categories, cwe_categories,
             executive_summary, recommendations, scan_report_json,
             llm_model, execution_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, scan_type, repository, branch, commit_sha,
            analysis.overall_security_score,
            d.critical, d.high, d.medium, d.low,
            json.dumps(analysis.owasp_categories_found),
            json.dumps(analysis.cwe_ids_found),
            analysis.executive_summary,
            json.dumps(analysis.recommendations),
            analysis.model_dump_json(),
            llm_model,
            round(execution_time, 3),
        ),
    )
    row = await fetchone("SELECT * FROM security_scan_reports WHERE id = ?", (row_id,))
    return row  # type: ignore[return-value]


# ── Helper: extract repo info from a PR URL ───────────────────────────────────

def _repo_from_pr_url(pr_url: str) -> tuple[str | None, str | None]:
    """Return (repository, branch) best-effort from a GitHub PR URL."""
    m = re.search(r"github\.com/([^/]+/[^/]+)/pull/\d+", pr_url)
    if m:
        return m.group(1), None
    return None, None


# ── Public API ────────────────────────────────────────────────────────────────

async def scan_pr(
    user_id: int,
    pr_url: str,
) -> SecurityScanReport:
    """
    Perform a security scan on a GitHub pull request.

    The existing PR-Agent engine fetches the diff; we send the security-
    analysis prompt as an ``ask`` question over that diff context.
    """
    logger = get_logger()
    prompt = _build_pr_prompt()

    artifact, elapsed = await _bridge._invoke_engine(
        pr_url=pr_url,
        command="ask",
        args=[prompt],
    )

    raw_text = (
        artifact if isinstance(artifact, str)
        else artifact.get("output", str(artifact)) if isinstance(artifact, dict)
        else str(artifact)
    )

    analysis = _parse_analysis(raw_text)
    repository, branch = _repo_from_pr_url(pr_url)

    try:
        from pr_agent.config_loader import get_settings as _ps
        llm_model = _ps().get("config.model", None)
    except Exception:
        llm_model = None

    row = await _save_report(
        user_id=user_id,
        scan_type="pr",
        repository=repository,
        branch=branch,
        commit_sha=None,
        analysis=analysis,
        llm_model=llm_model,
        execution_time=elapsed,
    )

    logger.info(
        f"Security scan saved: id={row['id']} repo={repository} "
        f"findings={len(analysis.findings)} score={analysis.overall_security_score}"
    )
    return SecurityScanReport.from_db(row)


async def scan_content(
    user_id: int,
    content: str,
    filename: str,
    scan_type: str = "zip",
) -> SecurityScanReport:
    """
    Perform a security scan on uploaded source content (ZIP extract or raw file).

    Content is embedded directly in the prompt — same technique as
    api_quality_service for spec files.
    """
    logger = get_logger()
    prompt = _build_content_prompt(content, filename)

    artifact, elapsed = await _bridge._invoke_engine(
        pr_url=_PLACEHOLDER_PR_URL,
        command="ask",
        args=[prompt],
    )

    raw_text = (
        artifact if isinstance(artifact, str)
        else artifact.get("output", str(artifact)) if isinstance(artifact, dict)
        else str(artifact)
    )

    analysis = _parse_analysis(raw_text)

    try:
        from pr_agent.config_loader import get_settings as _ps
        llm_model = _ps().get("config.model", None)
    except Exception:
        llm_model = None

    row = await _save_report(
        user_id=user_id,
        scan_type=scan_type,
        repository=filename,
        branch=None,
        commit_sha=None,
        analysis=analysis,
        llm_model=llm_model,
        execution_time=elapsed,
    )

    logger.info(
        f"Security scan saved: id={row['id']} file={filename} "
        f"findings={len(analysis.findings)} score={analysis.overall_security_score}"
    )
    return SecurityScanReport.from_db(row)


async def list_scans(
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    scan_type: str | None = None,
) -> PaginatedScanList:
    """Return a paginated list of scan reports for user_id."""
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)

    conditions = ["user_id = ?"]
    params: list[Any] = [user_id]

    if scan_type:
        conditions.append("scan_type = ?")
        params.append(scan_type)

    where = " AND ".join(conditions)

    count_row = await fetchone(
        f"SELECT COUNT(*) AS cnt FROM security_scan_reports WHERE {where}",
        tuple(params),
    )
    total = (count_row or {}).get("cnt") or 0
    offset = (page - 1) * page_size

    rows = await fetchall(
        f"""
        SELECT id, user_id, repository, branch, scan_type,
               overall_security_score, critical_count, high_count,
               medium_count, low_count, llm_model, execution_time, created_at
        FROM security_scan_reports
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        tuple(params) + (page_size, offset),
    )

    return PaginatedScanList(
        items=[SecurityScanListItem.from_db(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(math.ceil(total / page_size), 1),
    )


async def get_scan(scan_id: int, user_id: int) -> SecurityScanReport | None:
    """Return a full scan report if owned by user_id (IDOR prevention)."""
    row = await fetchone(
        "SELECT * FROM security_scan_reports WHERE id = ? AND user_id = ?",
        (scan_id, user_id),
    )
    return SecurityScanReport.from_db(row) if row else None


async def delete_scan(scan_id: int, user_id: int) -> bool:
    """Delete a scan owned by user_id. Returns True on success."""
    row = await fetchone(
        "SELECT id FROM security_scan_reports WHERE id = ? AND user_id = ?",
        (scan_id, user_id),
    )
    if not row:
        return False
    await execute("DELETE FROM security_scan_reports WHERE id = ?", (scan_id,))
    return True
