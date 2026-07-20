"""
AI Test Generator service.

Reuses the existing PR-Agent / Gemini pipeline via BasePRAgentService._invoke_engine.
No second AI pipeline is created — the same LiteLLM / Gemini call path used by
review, describe, improve, and ask is invoked here through the ``ask`` command
with a carefully crafted prompt.

Flow
----
1. Build a structured prompt asking the AI to generate tests for the PR.
2. Call _invoke_engine("ask", [prompt]) — identical path to AskService.
3. Parse the raw artifact into generated code + quality estimates.
4. Persist the result in the generated_tests table.
5. Return a GeneratedTestResponse.
"""
from __future__ import annotations

import math
import re
from typing import Any

from app.core.logger import get_logger
from app.db.database import execute, fetchall, fetchone
from app.schemas.test_generator import (
    GeneratedTestListItem,
    GeneratedTestResponse,
    LANGUAGE_DISPLAY,
    FRAMEWORK_DISPLAY,
    TEST_TYPE_DISPLAY,
    PaginatedTestList,
    TestQualityAnalysis,
)
from app.services.base_service import BasePRAgentService


# ── Thin subclass that routes through the existing engine ─────────────────────

class _AskBridge(BasePRAgentService):
    """Minimal subclass that sets tool_name='ask' to reuse _invoke_engine."""

    tool_name: str = "ask"


_bridge = _AskBridge()


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(language: str, framework: str, test_type: str) -> str:
    """
    Construct the natural-language prompt forwarded to the AI.

    The prompt is designed to elicit structured, production-quality test code
    and a brief quality analysis section that can be parsed from the response.
    """
    lang_label = LANGUAGE_DISPLAY.get(language, language)
    fw_label = FRAMEWORK_DISPLAY.get(framework, framework)
    type_label = TEST_TYPE_DISPLAY.get(test_type, test_type)

    return (
        f"Generate production-quality {type_label} for the changes in this PR "
        f"using {lang_label} and the {fw_label} testing framework.\n\n"
        "Requirements:\n"
        "1. Analyse every changed function, class, and method in the diff.\n"
        "2. Write complete, runnable test code with all necessary imports.\n"
        "3. Include test classes, test functions, mock objects, and assertions.\n"
        "4. Cover happy paths, edge cases, boundary conditions, and error handling.\n"
        "5. Add a docstring to each test explaining what it verifies.\n\n"
        "After the code, add a section titled '## Quality Analysis' that contains:\n"
        "- Estimated coverage percentage (0-100)\n"
        "- Confidence score (0-100)\n"
        "- Risk level (low | medium | high)\n"
        "- Up to 5 missing test scenarios as a bullet list\n\n"
        "Return ONLY the test code block followed by the Quality Analysis section. "
        "Do not include any other explanation outside those two sections."
    )


# ── Quality analysis parser ───────────────────────────────────────────────────

def _parse_quality(text: str) -> tuple[float | None, float | None, str | None, list[str]]:
    """
    Extract coverage%, confidence%, risk level, and missing scenarios
    from the '## Quality Analysis' section of the AI response.

    Returns (coverage, confidence, risk_level, missing_scenarios).
    All values may be None / empty if the AI did not include them.
    """
    coverage: float | None = None
    confidence: float | None = None
    risk_level: str | None = None
    missing: list[str] = []

    qa_match = re.search(r"##\s*Quality Analysis(.*?)(?:##|$)", text, re.DOTALL | re.IGNORECASE)
    if not qa_match:
        return coverage, confidence, risk_level, missing

    section = qa_match.group(1)

    cov_m = re.search(r"coverage[^:]*:\s*(\d+(?:\.\d+)?)", section, re.IGNORECASE)
    if cov_m:
        coverage = min(100.0, max(0.0, float(cov_m.group(1))))

    conf_m = re.search(r"confidence[^:]*:\s*(\d+(?:\.\d+)?)", section, re.IGNORECASE)
    if conf_m:
        confidence = min(100.0, max(0.0, float(conf_m.group(1))))

    risk_m = re.search(r"risk[^:]*:\s*(low|medium|high)", section, re.IGNORECASE)
    if risk_m:
        risk_level = risk_m.group(1).lower()

    # Bullet points as missing scenarios
    missing = [
        line.lstrip("-*• ").strip()
        for line in section.splitlines()
        if line.strip().startswith(("-", "*", "•")) and len(line.strip()) > 3
    ][:5]

    return coverage, confidence, risk_level, missing


def _extract_code(text: str) -> str:
    """
    Pull the first fenced code block out of the AI response.
    Falls back to the full text minus the Quality Analysis section.
    """
    # Try fenced block first
    fenced = re.search(r"```(?:\w+)?\n(.*?)```", text, re.DOTALL)
    if fenced:
        return fenced.group(1).strip()

    # Strip the quality analysis section and return the rest
    stripped = re.sub(r"##\s*Quality Analysis.*$", "", text, flags=re.DOTALL | re.IGNORECASE)
    return stripped.strip()


# ── Database helpers ──────────────────────────────────────────────────────────

async def _save_test(
    user_id: int,
    pr_url: str,
    language: str,
    framework: str,
    test_type: str,
    generated_code: str,
    coverage_score: float | None,
    confidence_score: float | None,
    risk_level: str | None,
    llm_model: str | None,
    execution_time: float,
) -> dict[str, Any]:
    """Insert a generated_tests row and return it."""
    row_id = await execute(
        """
        INSERT INTO generated_tests
            (user_id, pr_url, language, framework, test_type,
             generated_code, coverage_score, confidence_score,
             risk_level, llm_model, execution_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, pr_url, language, framework, test_type,
            generated_code, coverage_score, confidence_score,
            risk_level, llm_model, round(execution_time, 3),
        ),
    )
    row = await fetchone("SELECT * FROM generated_tests WHERE id = ?", (row_id,))
    return row  # type: ignore[return-value]


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_tests(
    user_id: int,
    pr_url: str,
    language: str,
    framework: str,
    test_type: str,
) -> GeneratedTestResponse:
    """
    Generate tests for a PR by routing through the existing ask pipeline.

    Raises PRAgentExecutionError / EmptyResultError on AI failure (propagated
    from BasePRAgentService._invoke_engine — identical to all other tools).
    """
    logger = get_logger()
    prompt = _build_prompt(language, framework, test_type)

    # Reuse the existing engine — same path as AskService.run()
    artifact, elapsed = await _bridge._invoke_engine(
        pr_url=pr_url,
        command="ask",
        args=[prompt],
    )

    # Normalise artifact to string (same logic as BasePRAgentService.run)
    if isinstance(artifact, str):
        raw_text = artifact
    elif isinstance(artifact, dict):
        raw_text = artifact.get("output", str(artifact))
    else:
        raw_text = str(artifact)

    # Parse components
    generated_code = _extract_code(raw_text)
    coverage, confidence, risk_level, missing = _parse_quality(raw_text)

    # Get model name for record-keeping (same approach as history_service)
    try:
        from pr_agent.config_loader import get_settings as _get_pr_settings
        llm_model = _get_pr_settings().get("config.model", None)
    except Exception:
        llm_model = None

    # Persist
    row = await _save_test(
        user_id=user_id,
        pr_url=pr_url,
        language=language,
        framework=framework,
        test_type=test_type,
        generated_code=generated_code,
        coverage_score=coverage,
        confidence_score=confidence,
        risk_level=risk_level,
        llm_model=llm_model,
        execution_time=elapsed,
    )

    logger.info(f"Tests generated: id={row['id']} lang={language} fw={framework} pr={pr_url}")

    response = GeneratedTestResponse.from_db(row)
    # Attach missing scenarios (not stored in DB, derived from raw output)
    response.quality = TestQualityAnalysis(
        coverage_score=coverage,
        confidence_score=confidence,
        risk_level=risk_level,
        missing_scenarios=missing,
    )
    return response


async def list_tests(
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    language: str | None = None,
    framework: str | None = None,
) -> PaginatedTestList:
    """Return a paginated list of generated tests for user_id."""
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)

    conditions = ["user_id = ?"]
    params: list[Any] = [user_id]

    if language:
        conditions.append("language = ?")
        params.append(language)
    if framework:
        conditions.append("framework = ?")
        params.append(framework)

    where = " AND ".join(conditions)

    count_row = await fetchone(
        f"SELECT COUNT(*) AS cnt FROM generated_tests WHERE {where}",
        tuple(params),
    )
    total = (count_row or {}).get("cnt") or 0

    offset = (page - 1) * page_size
    rows = await fetchall(
        f"""
        SELECT id, user_id, pr_url, language, framework, test_type,
               coverage_score, confidence_score, risk_level,
               llm_model, execution_time, created_at
        FROM generated_tests
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        tuple(params) + (page_size, offset),
    )

    return PaginatedTestList(
        items=[GeneratedTestListItem.from_db(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(math.ceil(total / page_size), 1),
    )


async def get_test(test_id: int, user_id: int) -> GeneratedTestResponse | None:
    """Return a single test record if owned by user_id (IDOR prevention)."""
    row = await fetchone(
        "SELECT * FROM generated_tests WHERE id = ? AND user_id = ?",
        (test_id, user_id),
    )
    return GeneratedTestResponse.from_db(row) if row else None


async def delete_test(test_id: int, user_id: int) -> bool:
    """Delete a test record owned by user_id. Returns True on success."""
    row = await fetchone(
        "SELECT id FROM generated_tests WHERE id = ? AND user_id = ?",
        (test_id, user_id),
    )
    if not row:
        return False
    await execute("DELETE FROM generated_tests WHERE id = ?", (test_id,))
    return True
