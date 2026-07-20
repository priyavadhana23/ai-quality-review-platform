"""Pydantic schemas for Team Workspace & Collaboration endpoints."""
from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

# ── Role constants ────────────────────────────────────────────────────────────

WorkspaceRole = Literal["owner", "admin", "maintainer", "developer", "qa_engineer", "viewer"]

ROLE_LABELS: dict[str, str] = {
    "owner": "Owner",
    "admin": "Admin",
    "maintainer": "Maintainer",
    "developer": "Developer",
    "qa_engineer": "QA Engineer",
    "viewer": "Viewer",
}

# Permissions per role — used for runtime checks
ROLE_PERMISSIONS: dict[str, dict[str, bool]] = {
    "owner":      {"review": True,  "test": True,  "scan": True,  "api": True,  "report": True,  "invite": True,  "manage": True},
    "admin":      {"review": True,  "test": True,  "scan": True,  "api": True,  "report": True,  "invite": True,  "manage": True},
    "maintainer": {"review": True,  "test": True,  "scan": True,  "api": True,  "report": True,  "invite": True,  "manage": False},
    "developer":  {"review": True,  "test": True,  "scan": True,  "api": False, "report": False, "invite": False, "manage": False},
    "qa_engineer":{"review": True,  "test": True,  "scan": True,  "api": True,  "report": True,  "invite": False, "manage": False},
    "viewer":     {"review": False, "test": False, "scan": False, "api": False, "report": False, "invite": False, "manage": False},
}

InviteStatus = Literal["pending", "accepted", "declined", "expired"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    """Convert a name to a URL-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:60]


# ── Organization schemas ──────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: str | None = None
    avatar_url: str | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class OrgResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    avatar_url: str | None
    owner_id: int
    created_at: str
    updated_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "OrgResponse":
        return cls(**{k: row[k] for k in cls.model_fields if k in row})


# ── Workspace schemas ─────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: str | None = None
    avatar_url: str | None = None
    organization_id: int | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=80)
    description: str | None = None
    avatar_url: str | None = None


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    avatar_url: str | None
    owner_id: int
    organization_id: int | None
    is_personal: bool
    member_count: int = 0
    created_at: str
    updated_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any], member_count: int = 0) -> "WorkspaceResponse":
        return cls(
            id=row["id"],
            name=row["name"],
            slug=row["slug"],
            description=row.get("description"),
            avatar_url=row.get("avatar_url"),
            owner_id=row["owner_id"],
            organization_id=row.get("organization_id"),
            is_personal=bool(row.get("is_personal", 0)),
            member_count=member_count,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class WorkspaceListResponse(BaseModel):
    items: list[WorkspaceResponse]
    total: int


# ── Member schemas ────────────────────────────────────────────────────────────

class MemberResponse(BaseModel):
    id: int
    workspace_id: int
    user_id: int
    username: str
    email: str | None
    avatar_url: str | None
    role: str
    joined_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "MemberResponse":
        return cls(
            id=row["id"],
            workspace_id=row["workspace_id"],
            user_id=row["user_id"],
            username=row.get("username") or "",
            email=row.get("email"),
            avatar_url=row.get("avatar_url"),
            role=row["role"],
            joined_at=row["joined_at"],
        )


class RoleUpdate(BaseModel):
    role: WorkspaceRole


# ── Invite schemas ────────────────────────────────────────────────────────────

class InviteCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: WorkspaceRole = "developer"

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.strip().lower()


class InviteResponse(BaseModel):
    id: int
    workspace_id: int
    invited_by: int
    email: str
    role: str
    token: str
    status: str
    expires_at: str
    created_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "InviteResponse":
        return cls(**{k: row[k] for k in cls.model_fields if k in row})


# ── Repository-workspace schemas ──────────────────────────────────────────────

class RepoAttach(BaseModel):
    github_owner: str = Field(..., min_length=1, max_length=100)
    github_repo: str = Field(..., min_length=1, max_length=100)


class WorkspaceRepoResponse(BaseModel):
    id: int
    workspace_id: int
    github_owner: str
    github_repo: str
    full_name: str
    added_by: int
    created_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "WorkspaceRepoResponse":
        return cls(
            id=row["id"],
            workspace_id=row["workspace_id"],
            github_owner=row["github_owner"],
            github_repo=row["github_repo"],
            full_name=f"{row['github_owner']}/{row['github_repo']}",
            added_by=row["added_by"],
            created_at=row["created_at"],
        )


# ── Activity log schemas ──────────────────────────────────────────────────────

class ActivityLogResponse(BaseModel):
    id: int
    workspace_id: int
    user_id: int | None
    username: str | None
    avatar_url: str | None
    action: str
    entity_type: str | None
    entity_id: int | None
    metadata: dict[str, Any]
    created_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "ActivityLogResponse":
        import json
        meta = {}
        try:
            meta = json.loads(row.get("metadata") or "{}")
        except Exception:
            pass
        return cls(
            id=row["id"],
            workspace_id=row["workspace_id"],
            user_id=row.get("user_id"),
            username=row.get("username"),
            avatar_url=row.get("avatar_url"),
            action=row["action"],
            entity_type=row.get("entity_type"),
            entity_id=row.get("entity_id"),
            metadata=meta,
            created_at=row["created_at"],
        )


class ActivityLogList(BaseModel):
    items: list[ActivityLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Notification schemas ──────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    workspace_id: int | None
    type: str
    title: str
    body: str
    is_read: bool
    metadata: dict[str, Any]
    created_at: str

    @classmethod
    def from_db(cls, row: dict[str, Any]) -> "NotificationResponse":
        import json
        meta = {}
        try:
            meta = json.loads(row.get("metadata") or "{}")
        except Exception:
            pass
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            workspace_id=row.get("workspace_id"),
            type=row["type"],
            title=row["title"],
            body=row["body"],
            is_read=bool(row.get("is_read", 0)),
            metadata=meta,
            created_at=row["created_at"],
        )


class NotificationList(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
    total: int


# ── Dashboard summary ─────────────────────────────────────────────────────────

class WorkspaceDashboard(BaseModel):
    workspace: WorkspaceResponse
    members: list[MemberResponse]
    repositories: list[WorkspaceRepoResponse]
    recent_activity: list[ActivityLogResponse]
    unread_notifications: int
    stats: dict[str, Any]
