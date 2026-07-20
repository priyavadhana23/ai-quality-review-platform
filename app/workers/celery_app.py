"""
Celery application + task definitions for long-running AI operations.

Worker command (in docker-compose or Railway):
    celery -A app.workers.celery_app worker --loglevel=info --concurrency=2

Each task:
  1. Calls the existing service layer (no duplication)
  2. Stores results/errors in Redis and the database
  3. Emits a WebSocket notification on completion

Broker / backend: Redis (APP_REDIS_URL)
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from celery import Celery

_log = logging.getLogger(__name__)

REDIS_URL = os.environ.get("APP_REDIS_URL", "redis://localhost:6379/0")

# ── Celery application ────────────────────────────────────────────────────────

app = Celery(
    "qrp_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.workers.celery_app"],
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.celery_app.run_review": {"queue": "ai_tasks"},
        "app.workers.celery_app.run_security_scan": {"queue": "ai_tasks"},
        "app.workers.celery_app.run_api_analysis": {"queue": "ai_tasks"},
        "app.workers.celery_app.run_test_generation": {"queue": "ai_tasks"},
        "app.workers.celery_app.run_report_generation": {"queue": "ai_tasks"},
    },
)


# ── Helper: run async code from a sync Celery task ───────────────────────────

def _run(coro: Any) -> Any:
    """Run an async coroutine from a synchronous Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ── Tasks ─────────────────────────────────────────────────────────────────────

@app.task(bind=True, name="app.workers.celery_app.run_review", max_retries=2)
def run_review(self: Any, user_id: int, pr_url: str, tool: str = "review") -> dict[str, Any]:
    """Run an AI review in the background and store the result."""
    try:
        from app.services.review_service import ReviewService
        service = ReviewService()
        _run(service.run(pr_url=pr_url, user_id=user_id))
        _notify_ws(user_id, "review_complete",
                   f"Review complete for {pr_url}", {"tool": tool, "pr_url": pr_url})
        return {"status": "success", "tool": tool}
    except Exception as exc:
        _log.error(f"run_review task failed: {exc}")
        raise self.retry(exc=exc, countdown=30)


@app.task(bind=True, name="app.workers.celery_app.run_security_scan", max_retries=2)
def run_security_scan(self: Any, user_id: int, pr_url: str) -> dict[str, Any]:
    """Run a security scan in the background."""
    try:
        from app.services.security_scanner_service import scan_pr
        _run(scan_pr(user_id=user_id, pr_url=pr_url))
        _notify_ws(user_id, "security_complete",
                   f"Security scan complete for {pr_url}", {"pr_url": pr_url})
        return {"status": "success"}
    except Exception as exc:
        _log.error(f"run_security_scan task failed: {exc}")
        raise self.retry(exc=exc, countdown=30)


@app.task(bind=True, name="app.workers.celery_app.run_api_analysis", max_retries=2)
def run_api_analysis(self: Any, user_id: int, content: str, filename: str) -> dict[str, Any]:
    """Run API quality analysis in the background."""
    try:
        from app.services.api_quality_service import scan_content
        _run(scan_content(user_id=user_id, content=content, filename=filename))
        _notify_ws(user_id, "api_analysis_complete",
                   f"API analysis complete for {filename}", {"filename": filename})
        return {"status": "success"}
    except Exception as exc:
        _log.error(f"run_api_analysis task failed: {exc}")
        raise self.retry(exc=exc, countdown=30)


@app.task(bind=True, name="app.workers.celery_app.run_test_generation", max_retries=2)
def run_test_generation(self: Any, user_id: int, pr_url: str,
                        language: str, framework: str, test_type: str) -> dict[str, Any]:
    """Generate tests in the background."""
    try:
        from app.services.test_generator_service import generate_tests
        from app.schemas.test_generator import TestGenerateRequest
        req = TestGenerateRequest(
            pr_url=pr_url, language=language,
            framework=framework, test_type=test_type,
        )
        _run(generate_tests(user_id=user_id, req=req))
        _notify_ws(user_id, "tests_complete",
                   f"Test generation complete for {pr_url}", {"pr_url": pr_url})
        return {"status": "success"}
    except Exception as exc:
        _log.error(f"run_test_generation task failed: {exc}")
        raise self.retry(exc=exc, countdown=30)


@app.task(bind=True, name="app.workers.celery_app.run_report_generation", max_retries=2)
def run_report_generation(self: Any, user_id: int, report_config: dict[str, Any]) -> dict[str, Any]:
    """Generate an enterprise report in the background."""
    try:
        from app.services.report_generator_service import generate_report
        from app.schemas.reports import ReportGenerateRequest
        req = ReportGenerateRequest(**report_config)
        _run(generate_report(user_id=user_id, req=req))
        _notify_ws(user_id, "report_complete", "Report generation complete", {})
        return {"status": "success"}
    except Exception as exc:
        _log.error(f"run_report_generation task failed: {exc}")
        raise self.retry(exc=exc, countdown=30)


# ── WebSocket notification helper ─────────────────────────────────────────────

def _notify_ws(user_id: int, event_type: str, message: str,
               metadata: dict[str, Any]) -> None:
    """Publish a notification to the Redis pub/sub channel for WebSockets."""
    import json
    try:
        import redis
        r = redis.from_url(REDIS_URL, decode_responses=True)
        payload = json.dumps({
            "user_id": user_id, "type": event_type,
            "message": message, "metadata": metadata,
        })
        r.publish(f"ws:user:{user_id}", payload)
    except Exception as exc:
        _log.debug(f"WebSocket notify failed: {exc}")
