"""
Async database layer using Python's built-in sqlite3 module.

All blocking sqlite3 calls are offloaded to a thread-pool via
``anyio.to_thread.run_sync`` so the FastAPI event-loop is never blocked.

Swap guide → PostgreSQL:
  Replace the three functions (_connect, _execute, _fetchone/_fetchall)
  with asyncpg equivalents.  The repository layer (user_repository.py)
  depends only on this module's public interface and requires no changes.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

import anyio
import anyio.to_thread

# ── Database file location ─────────────────────────────────────────────────────
# Stored next to the app package.  Override with APP_DB_URL env-var when needed.
_DB_PATH = Path(__file__).resolve().parent.parent.parent / "qrp_auth.db"


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── One-time schema initialisation ────────────────────────────────────────────
_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id   INTEGER NOT NULL UNIQUE,
    username    TEXT    NOT NULL,
    email       TEXT,
    avatar_url  TEXT,
    role        TEXT    NOT NULL DEFAULT 'user',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT    NOT NULL UNIQUE,
    expires_at  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    revoked     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS repositories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_owner TEXT    NOT NULL,
    github_repo  TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, github_owner, github_repo)
);

CREATE TABLE IF NOT EXISTS pull_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    pr_number     INTEGER NOT NULL,
    pr_url        TEXT    NOT NULL,
    title         TEXT,
    branch        TEXT,
    author        TEXT,
    status        TEXT    NOT NULL DEFAULT 'open',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (repository_id, pr_number)
);

CREATE TABLE IF NOT EXISTS reviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pull_request_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    tool            TEXT    NOT NULL,
    review_type     TEXT    NOT NULL DEFAULT 'automated',
    review_summary  TEXT,
    review_markdown TEXT    NOT NULL,
    raw_output      TEXT,
    execution_time  REAL    NOT NULL DEFAULT 0,
    llm_model       TEXT,
    tokens_used     INTEGER,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_metrics (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id            INTEGER NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
    security_score       INTEGER,
    quality_score        INTEGER,
    complexity_score     INTEGER,
    maintainability_score INTEGER,
    bugs_found           INTEGER NOT NULL DEFAULT 0,
    suggestions          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS generated_tests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pr_url          TEXT    NOT NULL,
    language        TEXT    NOT NULL,
    framework       TEXT    NOT NULL,
    test_type       TEXT    NOT NULL,
    generated_code  TEXT    NOT NULL,
    coverage_score  REAL,
    confidence_score REAL,
    risk_level      TEXT,
    llm_model       TEXT,
    execution_time  REAL    NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_generated_tests_user    ON generated_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_tests_created ON generated_tests(created_at);

CREATE TABLE IF NOT EXISTS api_quality_reports (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename             TEXT    NOT NULL,
    spec_version         TEXT    NOT NULL DEFAULT 'unknown',
    api_title            TEXT,
    api_version          TEXT,
    total_endpoints      INTEGER NOT NULL DEFAULT 0,
    analysis_json        TEXT    NOT NULL,
    quality_score        REAL,
    security_score       REAL,
    documentation_score  REAL,
    validation_score     REAL,
    design_score         REAL,
    recommendations      TEXT,
    llm_model            TEXT,
    execution_time       REAL    NOT NULL DEFAULT 0,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_quality_user    ON api_quality_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_api_quality_created ON api_quality_reports(created_at);

CREATE TABLE IF NOT EXISTS security_scan_reports (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_id             INTEGER,
    repository            TEXT,
    branch                TEXT,
    commit_sha            TEXT,
    scan_type             TEXT    NOT NULL DEFAULT 'pr',
    overall_security_score REAL,
    critical_count        INTEGER NOT NULL DEFAULT 0,
    high_count            INTEGER NOT NULL DEFAULT 0,
    medium_count          INTEGER NOT NULL DEFAULT 0,
    low_count             INTEGER NOT NULL DEFAULT 0,
    owasp_categories      TEXT    NOT NULL DEFAULT '[]',
    cwe_categories        TEXT    NOT NULL DEFAULT '[]',
    executive_summary     TEXT,
    recommendations       TEXT    NOT NULL DEFAULT '[]',
    scan_report_json      TEXT    NOT NULL DEFAULT '{}',
    llm_model             TEXT,
    execution_time        REAL    NOT NULL DEFAULT 0,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_scan_user    ON security_scan_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_security_scan_created ON security_scan_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_security_scan_type    ON security_scan_reports(scan_type);

CREATE TABLE IF NOT EXISTS generated_reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository      TEXT,
    pull_request    TEXT,
    report_type     TEXT    NOT NULL DEFAULT 'full',
    report_format   TEXT    NOT NULL DEFAULT 'markdown',
    report_title    TEXT    NOT NULL,
    summary         TEXT,
    report_path     TEXT,
    report_content  TEXT    NOT NULL DEFAULT '',
    generated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_user    ON generated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created ON generated_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type    ON generated_reports(report_type);

-- ── Team Workspace & Collaboration ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    NOT NULL UNIQUE,
    description TEXT,
    avatar_url  TEXT,
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orgs_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_orgs_slug  ON organizations(slug);

CREATE TABLE IF NOT EXISTS workspaces (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    slug            TEXT    NOT NULL,
    description     TEXT,
    avatar_url      TEXT,
    owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_personal     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_org   ON workspaces(organization_id);

CREATE TABLE IF NOT EXISTS workspace_members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT    NOT NULL DEFAULT 'developer',
    joined_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ws_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_members_user      ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email        TEXT    NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'developer',
    token        TEXT    NOT NULL UNIQUE,
    status       TEXT    NOT NULL DEFAULT 'pending',
    expires_at   TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ws_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_invites_token     ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_ws_invites_email     ON workspace_invites(email);

CREATE TABLE IF NOT EXISTS repositories_workspace (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    github_owner TEXT    NOT NULL,
    github_repo  TEXT    NOT NULL,
    added_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (workspace_id, github_owner, github_repo)
);

CREATE INDEX IF NOT EXISTS idx_ws_repos_workspace ON repositories_workspace(workspace_id);

CREATE TABLE IF NOT EXISTS roles_permissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    role        TEXT    NOT NULL UNIQUE,
    can_review  INTEGER NOT NULL DEFAULT 0,
    can_test    INTEGER NOT NULL DEFAULT 0,
    can_scan    INTEGER NOT NULL DEFAULT 0,
    can_api     INTEGER NOT NULL DEFAULT 0,
    can_report  INTEGER NOT NULL DEFAULT 0,
    can_invite  INTEGER NOT NULL DEFAULT 0,
    can_manage  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT    NOT NULL,
    entity_type  TEXT,
    entity_id    INTEGER,
    metadata     TEXT    NOT NULL DEFAULT '{}',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_created   ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_user      ON activity_logs(user_id);

CREATE TABLE IF NOT EXISTS notifications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    type         TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    body         TEXT    NOT NULL,
    is_read      INTEGER NOT NULL DEFAULT 0,
    metadata     TEXT    NOT NULL DEFAULT '{}',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);

CREATE INDEX IF NOT EXISTS idx_users_github_id    ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash  ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_repos_user          ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_repos_owner_repo    ON repositories(github_owner, github_repo);
CREATE INDEX IF NOT EXISTS idx_prs_repository      ON pull_requests(repository_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pr          ON reviews(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created     ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_tool        ON reviews(tool);
"""


def _init_db_sync() -> None:
    conn = _get_connection()
    try:
        conn.executescript(_SCHEMA)
        conn.commit()
    finally:
        conn.close()


async def init_db() -> None:
    """Create tables if they don't exist.  Called once at app startup."""
    await anyio.to_thread.run_sync(_init_db_sync)


# ── Generic async helpers ──────────────────────────────────────────────────────

async def execute(sql: str, params: tuple[Any, ...] = ()) -> int:
    """Run an INSERT / UPDATE / DELETE and return the last-inserted rowid."""
    def _run() -> int:
        conn = _get_connection()
        try:
            cur = conn.execute(sql, params)
            conn.commit()
            return cur.lastrowid or 0
        finally:
            conn.close()
    return await anyio.to_thread.run_sync(_run)


async def fetchone(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    """Run a SELECT and return the first row as a dict, or None."""
    def _run() -> dict[str, Any] | None:
        conn = _get_connection()
        try:
            cur = conn.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()
    return await anyio.to_thread.run_sync(_run)


async def fetchall(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    """Run a SELECT and return all rows as a list of dicts."""
    def _run() -> list[dict[str, Any]]:
        conn = _get_connection()
        try:
            cur = conn.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()
    return await anyio.to_thread.run_sync(_run)
