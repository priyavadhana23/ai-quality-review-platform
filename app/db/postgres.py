"""
PostgreSQL async adapter using asyncpg via SQLAlchemy 2.x.

This module provides the SAME public interface as app/db/database.py
(execute, fetchone, fetchall, init_db) so existing services require
zero changes to switch backends.

Backend selection
-----------------
  APP_DATABASE_URL=postgresql+asyncpg://...  → PostgreSQL (this module)
  (unset / sqlite)                           → SQLite  (database.py)

Usage in app/db/__init__.py (auto-selected at import time).
"""
from __future__ import annotations

import os
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

_DATABASE_URL: str = os.environ.get("APP_DATABASE_URL", "")

_engine: AsyncEngine | None = None
_SessionLocal: sessionmaker | None = None  # type: ignore[type-arg]


def _get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            _DATABASE_URL,
            echo=False,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
        )
    return _engine


def _get_session() -> AsyncSession:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(  # type: ignore[call-overload]
            _get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _SessionLocal()


# ── Schema (mirrors database.py _SCHEMA but in PostgreSQL DDL) ───────────────

_SCHEMA_PG = """
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    github_id   INTEGER NOT NULL UNIQUE,
    username    TEXT    NOT NULL,
    email       TEXT,
    avatar_url  TEXT,
    role        TEXT    NOT NULL DEFAULT 'user',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT    NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS repositories (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_owner TEXT    NOT NULL,
    github_repo  TEXT    NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, github_owner, github_repo)
);
CREATE TABLE IF NOT EXISTS pull_requests (
    id            SERIAL PRIMARY KEY,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    pr_number     INTEGER NOT NULL,
    pr_url        TEXT    NOT NULL,
    title         TEXT,
    branch        TEXT,
    author        TEXT,
    status        TEXT    NOT NULL DEFAULT 'open',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (repository_id, pr_number)
);
CREATE TABLE IF NOT EXISTS reviews (
    id              SERIAL PRIMARY KEY,
    pull_request_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    tool            TEXT    NOT NULL,
    review_type     TEXT    NOT NULL DEFAULT 'automated',
    review_summary  TEXT,
    review_markdown TEXT    NOT NULL,
    raw_output      TEXT,
    execution_time  FLOAT   NOT NULL DEFAULT 0,
    llm_model       TEXT,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS review_metrics (
    id                    SERIAL PRIMARY KEY,
    review_id             INTEGER NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
    security_score        INTEGER,
    quality_score         INTEGER,
    complexity_score      INTEGER,
    maintainability_score INTEGER,
    bugs_found            INTEGER NOT NULL DEFAULT 0,
    suggestions           INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS generated_tests (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pr_url           TEXT    NOT NULL,
    language         TEXT    NOT NULL,
    framework        TEXT    NOT NULL,
    test_type        TEXT    NOT NULL,
    generated_code   TEXT    NOT NULL,
    coverage_score   FLOAT,
    confidence_score FLOAT,
    risk_level       TEXT,
    llm_model        TEXT,
    execution_time   FLOAT   NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS api_quality_reports (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename            TEXT    NOT NULL,
    spec_version        TEXT    NOT NULL DEFAULT 'unknown',
    api_title           TEXT,
    api_version         TEXT,
    total_endpoints     INTEGER NOT NULL DEFAULT 0,
    analysis_json       TEXT    NOT NULL,
    quality_score       FLOAT,
    security_score      FLOAT,
    documentation_score FLOAT,
    validation_score    FLOAT,
    design_score        FLOAT,
    recommendations     TEXT,
    llm_model           TEXT,
    execution_time      FLOAT   NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS security_scan_reports (
    id                     SERIAL PRIMARY KEY,
    user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_id              INTEGER,
    repository             TEXT,
    branch                 TEXT,
    commit_sha             TEXT,
    scan_type              TEXT    NOT NULL DEFAULT 'pr',
    overall_security_score FLOAT,
    critical_count         INTEGER NOT NULL DEFAULT 0,
    high_count             INTEGER NOT NULL DEFAULT 0,
    medium_count           INTEGER NOT NULL DEFAULT 0,
    low_count              INTEGER NOT NULL DEFAULT 0,
    owasp_categories       TEXT    NOT NULL DEFAULT '[]',
    cwe_categories         TEXT    NOT NULL DEFAULT '[]',
    executive_summary      TEXT,
    recommendations        TEXT    NOT NULL DEFAULT '[]',
    scan_report_json       TEXT    NOT NULL DEFAULT '{}',
    llm_model              TEXT,
    execution_time         FLOAT   NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS generated_reports (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository     TEXT,
    pull_request   TEXT,
    report_type    TEXT    NOT NULL DEFAULT 'full',
    report_format  TEXT    NOT NULL DEFAULT 'markdown',
    report_title   TEXT    NOT NULL,
    summary        TEXT,
    report_path    TEXT,
    report_content TEXT    NOT NULL DEFAULT '',
    generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS organizations (
    id          SERIAL PRIMARY KEY,
    name        TEXT    NOT NULL,
    slug        TEXT    NOT NULL UNIQUE,
    description TEXT,
    avatar_url  TEXT,
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workspaces (
    id              SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    slug            TEXT    NOT NULL,
    description     TEXT,
    avatar_url      TEXT,
    owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_personal     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, slug)
);
CREATE TABLE IF NOT EXISTS workspace_members (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT    NOT NULL DEFAULT 'developer',
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS workspace_invites (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email        TEXT    NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'developer',
    token        TEXT    NOT NULL UNIQUE,
    status       TEXT    NOT NULL DEFAULT 'pending',
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS repositories_workspace (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    github_owner TEXT    NOT NULL,
    github_repo  TEXT    NOT NULL,
    added_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, github_owner, github_repo)
);
CREATE TABLE IF NOT EXISTS roles_permissions (
    id         SERIAL PRIMARY KEY,
    role       TEXT    NOT NULL UNIQUE,
    can_review BOOLEAN NOT NULL DEFAULT FALSE,
    can_test   BOOLEAN NOT NULL DEFAULT FALSE,
    can_scan   BOOLEAN NOT NULL DEFAULT FALSE,
    can_api    BOOLEAN NOT NULL DEFAULT FALSE,
    can_report BOOLEAN NOT NULL DEFAULT FALSE,
    can_invite BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS activity_logs (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT    NOT NULL,
    entity_type  TEXT,
    entity_id    INTEGER,
    metadata     JSONB   NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    type         TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    body         TEXT    NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    metadata     JSONB   NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_INDEXES_PG = """
CREATE INDEX IF NOT EXISTS idx_users_github_id     ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash  ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_repos_user          ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_prs_repository      ON pull_requests(repository_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pr          ON reviews(pull_request_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created     ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_tool        ON reviews(tool);
CREATE INDEX IF NOT EXISTS idx_gen_tests_user      ON generated_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_api_quality_user    ON api_quality_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_security_scan_user  ON security_scan_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_gen_reports_user    ON generated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_members_ws       ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_members_user     ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_invites_ws       ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_invites_token    ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_activity_ws         ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_created    ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
"""


async def init_db() -> None:
    """Create all tables and indexes in PostgreSQL."""
    async with _get_engine().begin() as conn:
        await conn.execute(text(_SCHEMA_PG))
        await conn.execute(text(_INDEXES_PG))


async def execute(sql: str, params: tuple[Any, ...] = ()) -> int:
    """Run INSERT/UPDATE/DELETE and return the last-inserted id."""
    async with _get_session() as session:
        async with session.begin():
            result = await session.execute(
                text(sql + " RETURNING id" if sql.strip().upper().startswith("INSERT") else sql),
                _params_dict(sql, params),
            )
            if sql.strip().upper().startswith("INSERT"):
                row = result.fetchone()
                return row[0] if row else 0
            return result.rowcount or 0


async def fetchone(sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    """Run SELECT and return the first row as a dict, or None."""
    async with _get_session() as session:
        result = await session.execute(text(sql), _params_dict(sql, params))
        row = result.mappings().fetchone()
        return dict(row) if row else None


async def fetchall(sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    """Run SELECT and return all rows as a list of dicts."""
    async with _get_session() as session:
        result = await session.execute(text(sql), _params_dict(sql, params))
        return [dict(r) for r in result.mappings().fetchall()]


def _params_dict(sql: str, params: tuple[Any, ...]) -> dict[str, Any]:
    """Convert positional ? params to SQLAlchemy :p0 named params."""
    placeholders = sql.count("?")
    if placeholders != len(params):
        return {}
    return {f"p{i}": v for i, v in enumerate(params)}
