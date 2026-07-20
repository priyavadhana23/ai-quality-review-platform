"""
GitHub Webhook router.

POST /webhooks/github — receives GitHub webhook events and auto-triggers
AI review for pull_request (opened, synchronize, reopened) and push events.

Security: HMAC-SHA256 signature is validated against GITHUB__WEBHOOK_SECRET.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

WEBHOOK_SECRET: str = os.environ.get("GITHUB__WEBHOOK_SECRET", "")

# User ID to attribute auto-triggered reviews to (a "bot" user in the DB).
# Defaults to 1; override via APP_WEBHOOK_USER_ID env var.
WEBHOOK_USER_ID: int = int(os.environ.get("APP_WEBHOOK_USER_ID", "1"))


# ── Signature verification ────────────────────────────────────────────────────

def _verify_signature(body: bytes, sig_header: str | None) -> bool:
    """Validate X-Hub-Signature-256 HMAC."""
    if not WEBHOOK_SECRET:
        _log.warning("GITHUB__WEBHOOK_SECRET not set — skipping signature check")
        return True
    if not sig_header or not sig_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig_header)


# ── Event handlers ────────────────────────────────────────────────────────────

async def _handle_pull_request(payload: dict[str, Any]) -> str:
    action = payload.get("action", "")
    if action not in ("opened", "synchronize", "reopened"):
        return f"ignored action={action}"

    pr = payload.get("pull_request", {})
    html_url: str = pr.get("html_url", "")
    if not html_url:
        return "no pr url"

    try:
        # Queue in background via Celery if available, else skip
        from app.workers.celery_app import run_review
        run_review.delay(user_id=WEBHOOK_USER_ID, pr_url=html_url, tool="review")
        _log.info(f"Queued auto-review for PR: {html_url}")
        return f"queued review for {html_url}"
    except ImportError:
        _log.warning("Celery not available — webhook review skipped")
        return "celery unavailable"
    except Exception as exc:
        _log.error(f"Failed to queue review: {exc}")
        return f"error: {exc}"


async def _handle_push(payload: dict[str, Any]) -> str:
    _log.debug(f"Push event received for {payload.get('repository', {}).get('full_name', '')}")
    return "push received"


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/github",
    status_code=status.HTTP_200_OK,
    summary="GitHub webhook receiver",
    description=(
        "Receives GitHub webhook events (pull_request, push). "
        "Validates HMAC-SHA256 signature and queues AI reviews."
    ),
)
async def github_webhook(request: Request) -> dict[str, str]:
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256")

    if not _verify_signature(body, sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    event_type = request.headers.get("X-GitHub-Event", "")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if event_type == "pull_request":
        result = await _handle_pull_request(payload)
    elif event_type == "push":
        result = await _handle_push(payload)
    elif event_type == "ping":
        result = "pong"
    else:
        result = f"unhandled event: {event_type}"

    return {"status": "ok", "result": result}
