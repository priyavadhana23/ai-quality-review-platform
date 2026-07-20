"""Initial schema — all tables for the AI Quality Review Platform.

Revision ID: 0001
Revises:
Create Date: 2025-07-20 00:00:00.000000
"""
from __future__ import annotations
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, github_id INTEGER NOT NULL UNIQUE,
        username TEXT NOT NULL, email TEXT, avatar_url TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS repositories (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        github_owner TEXT NOT NULL, github_repo TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, github_owner, github_repo)
    );
    CREATE TABLE IF NOT EXISTS pull_requests (
        id SERIAL PRIMARY KEY,
        repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        pr_number INTEGER NOT NULL, pr_url TEXT NOT NULL,
        title TEXT, branch TEXT, author TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (repository_id, pr_number)
    );
    CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        pull_request_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
        tool TEXT NOT NULL, review_type TEXT NOT NULL DEFAULT 'automated',
        review_summary TEXT, review_markdown TEXT NOT NULL,
        raw_output TEXT, execution_time FLOAT NOT NULL DEFAULT 0,
        llm_model TEXT, tokens_used INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS review_metrics (
        id SERIAL PRIMARY KEY,
        review_id INTEGER NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
        security_score INTEGER, quality_score INTEGER,
        complexity_score INTEGER, maintainability_score INTEGER,
        bugs_found INTEGER NOT NULL DEFAULT 0, suggestions INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS generated_tests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pr_url TEXT NOT NULL, language TEXT NOT NULL, framework TEXT NOT NULL,
        test_type TEXT NOT NULL, generated_code TEXT NOT NULL,
        coverage_score FLOAT, confidence_score FLOAT, risk_level TEXT,
        llm_model TEXT, execution_time FLOAT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS api_quality_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL, spec_version TEXT NOT NULL DEFAULT 'unknown',
        api_title TEXT, api_version TEXT, total_endpoints INTEGER NOT NULL DEFAULT 0,
        analysis_json TEXT NOT NULL, quality_score FLOAT, security_score FLOAT,
        documentation_score FLOAT, validation_score FLOAT, design_score FLOAT,
        recommendations TEXT, llm_model TEXT, execution_time FLOAT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS security_scan_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        review_id INTEGER, repository TEXT, branch TEXT, commit_sha TEXT,
        scan_type TEXT NOT NULL DEFAULT 'pr', overall_security_score FLOAT,
        critical_count INTEGER NOT NULL DEFAULT 0, high_count INTEGER NOT NULL DEFAULT 0,
        medium_count INTEGER NOT NULL DEFAULT 0, low_count INTEGER NOT NULL DEFAULT 0,
        owasp_categories TEXT NOT NULL DEFAULT '[]', cwe_categories TEXT NOT NULL DEFAULT '[]',
        executive_summary TEXT, recommendations TEXT NOT NULL DEFAULT '[]',
        scan_report_json TEXT NOT NULL DEFAULT '{}', llm_model TEXT,
        execution_time FLOAT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS generated_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        repository TEXT, pull_request TEXT, report_type TEXT NOT NULL DEFAULT 'full',
        report_format TEXT NOT NULL DEFAULT 'markdown', report_title TEXT NOT NULL,
        summary TEXT, report_path TEXT, report_content TEXT NOT NULL DEFAULT '',
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
        description TEXT, avatar_url TEXT,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT, avatar_url TEXT,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_personal BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, slug)
    );
    CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'developer',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (workspace_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS workspace_invites (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'developer',
        token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS repositories_workspace (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        github_owner TEXT NOT NULL, github_repo TEXT NOT NULL,
        added_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (workspace_id, github_owner, github_repo)
    );
    CREATE TABLE IF NOT EXISTS roles_permissions (
        id SERIAL PRIMARY KEY, role TEXT NOT NULL UNIQUE,
        can_review BOOLEAN NOT NULL DEFAULT FALSE,
        can_test BOOLEAN NOT NULL DEFAULT FALSE,
        can_scan BOOLEAN NOT NULL DEFAULT FALSE,
        can_api BOOLEAN NOT NULL DEFAULT FALSE,
        can_report BOOLEAN NOT NULL DEFAULT FALSE,
        can_invite BOOLEAN NOT NULL DEFAULT FALSE,
        can_manage BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL, entity_type TEXT, entity_id INTEGER,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """)


def downgrade() -> None:
    tables = [
        "notifications", "activity_logs", "roles_permissions",
        "repositories_workspace", "workspace_invites", "workspace_members",
        "workspaces", "organizations", "generated_reports",
        "security_scan_reports", "api_quality_reports", "generated_tests",
        "review_metrics", "reviews", "pull_requests", "repositories",
        "refresh_tokens", "users",
    ]
    for t in tables:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
