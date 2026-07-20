"""
API Quality Analyzer service.

Reuses the existing Gemini / LiteLLM pipeline via BasePRAgentService._invoke_engine,
following the same pattern established by test_generator_service.py.

The OpenAPI/Swagger spec is provided as a URL (the AI fetches the referenced PR
context) — but because _invoke_engine requires a PR URL we use a well-known
public spec URL as the "PR URL" context and embed the actual spec content in
the prompt.  This is identical to how AskService works: the engine is asked a
question about an existing PR; here we ask it to analyse an API spec text that
we embed directly in the question.

Flow
----
1. Receive spec content (text) + filename.
2. Parse spec metadata (title, version, endpoint count) from YAML/JSON.
3. Build a structured prompt embedding the spec text.
4. Call _invoke_engine("ask", [prompt]) with a placeholder PR URL.
5. Parse the AI response into ApiQualityAnalysis.
6. Persist to api_quality_reports.
7. Return ApiQualityReport.
"""
from __future__ import annotations

import json
import math
import re
from typing import Any

import yaml

from app.core.logger import get_logger
from app.db.database import execute, fetchall, fetchone
from app.schemas.api_quality import (
    ApiIssue,
    ApiQualityAnalysis,
    ApiQualityListItem,
    ApiQualityReport,
    ApiQualityScores,
    EndpointSummary,
    PaginatedReportList,
)
from app.services.base_service import BasePRAgentService

# ── PR URL used as the "context" for _invoke_engine ──────────────────────────
# The ask command requires a valid GitHub PR URL to initialise the agent.
# We use the pr-agent repo's own first PR — it always exists and is public.
_PLACEHOLDER_PR_URL = "https://github.com/Codium-ai/pr-agent/pull/1"

_MAX_SPEC_CHARS = 12_000  # truncate very large specs to stay within token limits


# ── Thin bridge — identical pattern to test_generator_service ─────────────────

class _AskBridge(BasePRAgentService):
    tool_name: str = "ask"


_bridge = _AskBridge()


# ── Spec metadata parser ──────────────────────────────────────────────────────

def _parse_spec_metadata(
    content: str,
) -> tuple[str, str | None, str | None, int, list[dict[str, Any]]]:
    """
    Extract (spec_version, api_title, api_version, total_endpoints, endpoints)
    from raw YAML or JSON spec text.

    Returns safe defaults on parse failure.
    """
    try:
        doc: dict[str, Any] = yaml.safe_load(content)
    except Exception:
        try:
            doc = json.loads(content)
        except Exception:
            return "unknown", None, None, 0, []

    if not isinstance(doc, dict):
        return "unknown", None, None, 0, []

    # Determine spec version
    if "openapi" in doc:
        spec_ver = f"OpenAPI {doc['openapi']}"
    elif "swagger" in doc:
        spec_ver = f"Swagger {doc['swagger']}"
    else:
        spec_ver = "unknown"

    info = doc.get("info") or {}
    api_title = info.get("title")
    api_version = info.get("version")

    paths: dict[str, Any] = doc.get("paths") or {}
    endpoints: list[dict[str, Any]] = []
    http_methods = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method, op in path_item.items():
            if method.lower() not in http_methods:
                continue
            if not isinstance(op, dict):
                continue
            endpoints.append({"method": method.upper(), "path": path, "op": op})

    return spec_ver, api_title, str(api_version) if api_version else None, len(endpoints), endpoints


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(spec_content: str, filename: str) -> str:
    """Build the structured analysis prompt embedding the spec text."""
    truncated = spec_content[:_MAX_SPEC_CHARS]
    if len(spec_content) > _MAX_SPEC_CHARS:
        truncated += "\n\n[... spec truncated for length ...]"

    return (
        f"You are an expert API architect. Analyse the following OpenAPI/Swagger "
        f"specification (filename: {filename}) and produce a comprehensive quality report.\n\n"
        "Evaluate ALL of the following dimensions:\n"
        "- Security: authentication, authorization, API keys, OAuth scopes\n"
        "- Validation: request/response schemas, required fields, data types, formats\n"
        "- REST Design: resource naming, HTTP methods, status codes, idempotency\n"
        "- Documentation: descriptions, examples, summaries for every operation\n"
        "- Consistency: naming conventions, response envelope patterns\n"
        "- Best Practices: versioning, pagination, filtering, sorting, rate limiting, error responses\n\n"
        "Return your analysis as a JSON object with EXACTLY this structure "
        "(all fields required, use empty arrays/strings for missing data):\n"
        "{\n"
        '  "executive_summary": "<2-4 sentence overview>",\n'
        '  "strengths": ["...", "..."],\n'
        '  "weaknesses": ["...", "..."],\n'
        '  "critical_issues": [{"severity":"critical","category":"security",'
        '"title":"...","description":"...","recommendation":"..."}],\n'
        '  "warnings": [{"severity":"warning","category":"design",'
        '"title":"...","description":"...","recommendation":"..."}],\n'
        '  "recommendations": ["...", "..."],\n'
        '  "best_practices": ["...", "..."],\n'
        '  "scores": {'
        '"overall":<0-100>,"security":<0-100>,"documentation":<0-100>,'
        '"validation":<0-100>,"design":<0-100>,"maintainability":<0-100>},\n'
        '  "endpoints": [{"method":"GET","path":"/users","has_auth":true,'
        '"has_request_schema":false,"has_response_schema":true,"has_description":true,"issues":[]}]\n'
        "}\n\n"
        "Return ONLY the JSON object — no markdown fences, no extra explanation.\n\n"
        f"=== SPECIFICATION ===\n{truncated}"
    )


# ── AI response parser ────────────────────────────────────────────────────────

def _parse_analysis(raw_text: str) -> ApiQualityAnalysis:
    """
    Extract and validate the JSON object from the AI response.
    Falls back to a minimal analysis if parsing fails.
    """
    # Strip markdown fences if present
    text = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text.strip())

    # Find first { ... } block
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        text = brace_match.group(0)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return ApiQualityAnalysis(
            executive_summary=raw_text[:500],
            recommendations=["Unable to parse structured analysis — see executive summary."],
        )

    def _issues(lst: list[Any]) -> list[ApiIssue]:
        out = []
        for item in (lst or []):
            if isinstance(item, dict):
                try:
                    out.append(ApiIssue(**{k: v for k, v in item.items() if k in ApiIssue.model_fields}))
                except Exception:
                    pass
        return out

    def _endpoints(lst: list[Any]) -> list[EndpointSummary]:
        out = []
        for item in (lst or []):
            if isinstance(item, dict):
                try:
                    out.append(EndpointSummary(**{k: v for k, v in item.items() if k in EndpointSummary.model_fields}))
                except Exception:
                    pass
        return out

    scores_raw = data.get("scores") or {}

    def _score(k: str) -> float | None:
        v = scores_raw.get(k)
        if v is None:
            return None
        try:
            return min(100.0, max(0.0, float(v)))
        except Exception:
            return None

    return ApiQualityAnalysis(
        executive_summary=str(data.get("executive_summary") or ""),
        strengths=[str(s) for s in (data.get("strengths") or [])],
        weaknesses=[str(s) for s in (data.get("weaknesses") or [])],
        critical_issues=_issues(data.get("critical_issues") or []),
        warnings=_issues(data.get("warnings") or []),
        recommendations=[str(s) for s in (data.get("recommendations") or [])],
        best_practices=[str(s) for s in (data.get("best_practices") or [])],
        scores=ApiQualityScores(
            overall=_score("overall"),
            security=_score("security"),
            documentation=_score("documentation"),
            validation=_score("validation"),
            design=_score("design"),
            maintainability=_score("maintainability"),
        ),
        endpoints=_endpoints(data.get("endpoints") or []),
    )


# ── Database helpers ──────────────────────────────────────────────────────────

async def _save_report(
    user_id: int,
    filename: str,
    spec_version: str,
    api_title: str | None,
    api_version: str | None,
    total_endpoints: int,
    analysis: ApiQualityAnalysis,
    llm_model: str | None,
    execution_time: float,
) -> dict[str, Any]:
    s = analysis.scores
    row_id = await execute(
        """
        INSERT INTO api_quality_reports
            (user_id, filename, spec_version, api_title, api_version,
             total_endpoints, analysis_json, quality_score, security_score,
             documentation_score, validation_score, design_score,
             recommendations, llm_model, execution_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, filename, spec_version, api_title, api_version,
            total_endpoints, analysis.model_dump_json(),
            s.overall, s.security, s.documentation, s.validation, s.design,
            json.dumps(analysis.recommendations),
            llm_model, round(execution_time, 3),
        ),
    )
    row = await fetchone("SELECT * FROM api_quality_reports WHERE id = ?", (row_id,))
    return row  # type: ignore[return-value]


# ── Public API ────────────────────────────────────────────────────────────────

async def analyze_spec(
    user_id: int,
    spec_content: str,
    filename: str,
) -> ApiQualityReport:
    """
    Analyse an OpenAPI/Swagger specification using the existing AI pipeline.

    spec_content: raw YAML or JSON text of the spec.
    filename:     original filename (used for display and download).
    """
    logger = get_logger()

    spec_version, api_title, api_version, total_endpoints, _ = _parse_spec_metadata(spec_content)
    prompt = _build_prompt(spec_content, filename)

    artifact, elapsed = await _bridge._invoke_engine(
        pr_url=_PLACEHOLDER_PR_URL,
        command="ask",
        args=[prompt],
    )

    if isinstance(artifact, str):
        raw_text = artifact
    elif isinstance(artifact, dict):
        raw_text = artifact.get("output", str(artifact))
    else:
        raw_text = str(artifact)

    analysis = _parse_analysis(raw_text)

    try:
        from pr_agent.config_loader import get_settings as _get_pr_settings
        llm_model = _get_pr_settings().get("config.model", None)
    except Exception:
        llm_model = None

    row = await _save_report(
        user_id=user_id,
        filename=filename,
        spec_version=spec_version,
        api_title=api_title,
        api_version=api_version,
        total_endpoints=total_endpoints,
        analysis=analysis,
        llm_model=llm_model,
        execution_time=elapsed,
    )

    logger.info(
        f"API quality report saved: id={row['id']} file={filename} "
        f"endpoints={total_endpoints} score={analysis.scores.overall}"
    )
    return ApiQualityReport.from_db(row)


async def list_reports(
    user_id: int,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedReportList:
    """Return a paginated list of reports for user_id."""
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)

    count_row = await fetchone(
        "SELECT COUNT(*) AS cnt FROM api_quality_reports WHERE user_id = ?",
        (user_id,),
    )
    total = (count_row or {}).get("cnt") or 0
    offset = (page - 1) * page_size

    rows = await fetchall(
        """
        SELECT id, user_id, filename, spec_version, api_title, api_version,
               total_endpoints, quality_score, security_score,
               documentation_score, validation_score, design_score,
               llm_model, execution_time, created_at
        FROM api_quality_reports
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        (user_id, page_size, offset),
    )
    return PaginatedReportList(
        items=[ApiQualityListItem.from_db(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(math.ceil(total / page_size), 1),
    )


async def get_report(report_id: int, user_id: int) -> ApiQualityReport | None:
    """Return a full report if owned by user_id (IDOR prevention)."""
    row = await fetchone(
        "SELECT * FROM api_quality_reports WHERE id = ? AND user_id = ?",
        (report_id, user_id),
    )
    return ApiQualityReport.from_db(row) if row else None


async def delete_report(report_id: int, user_id: int) -> bool:
    """Delete a report owned by user_id. Returns True on success."""
    row = await fetchone(
        "SELECT id FROM api_quality_reports WHERE id = ? AND user_id = ?",
        (report_id, user_id),
    )
    if not row:
        return False
    await execute("DELETE FROM api_quality_reports WHERE id = ?", (report_id,))
    return True
