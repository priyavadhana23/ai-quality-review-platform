"""
Team Workspace & Collaboration service.

Pure orchestration over the database — no AI engine calls.
All public functions are scoped to the requesting user_id to prevent IDOR.
"""
from __future__ import annotations

import json
import math
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db.database import execute, fetchall, fetchone
from app.schemas.workspace import (
    ActivityLogList, ActivityLogResponse, InviteCreate, InviteResponse,
    MemberResponse, NotificationList, NotificationResponse, OrgCreate,
    OrgResponse, RepoAttach, RoleUpdate, WorkspaceCreate, WorkspaceDashboard,
    WorkspaceListResponse, WorkspaceRepoResponse, WorkspaceResponse,
    WorkspaceUpdate, _slugify,
)

# ── Internal helpers ──────────────────────────────────────────────────────────

async def _assert_member(workspace_id: int, user_id: int) -> dict[str, Any]:
    row = await fetchone(
        "SELECT * FROM workspace_members WHERE workspace_id=? AND user_id=?",
        (workspace_id, user_id))
    if not row:
        raise ValueError("Not a member of this workspace")
    return row


async def _assert_permission(workspace_id: int, user_id: int, permission: str) -> None:
    from app.schemas.workspace import ROLE_PERMISSIONS
    row = await _assert_member(workspace_id, user_id)
    role = row.get("role", "viewer")
    if not ROLE_PERMISSIONS.get(role, {}).get(permission, False):
        raise PermissionError(f"Role '{role}' cannot perform '{permission}'")


async def _log(workspace_id: int, user_id: int | None, action: str,
               entity_type: str | None = None, entity_id: int | None = None,
               metadata: dict[str, Any] | None = None) -> None:
    await execute(
        "INSERT INTO activity_logs (workspace_id,user_id,action,entity_type,entity_id,metadata)"
        " VALUES (?,?,?,?,?,?)",
        (workspace_id, user_id, action, entity_type, entity_id, json.dumps(metadata or {})))


async def _notify(user_id: int, ntype: str, title: str, body: str,
                  workspace_id: int | None = None,
                  metadata: dict[str, Any] | None = None) -> None:
    await execute(
        "INSERT INTO notifications (user_id,workspace_id,type,title,body,metadata)"
        " VALUES (?,?,?,?,?,?)",
        (user_id, workspace_id, ntype, title, body, json.dumps(metadata or {})))


async def _member_count(workspace_id: int) -> int:
    row = await fetchone(
        "SELECT COUNT(*) AS cnt FROM workspace_members WHERE workspace_id=?",
        (workspace_id,))
    return (row or {}).get("cnt") or 0

# ── Organization CRUD ─────────────────────────────────────────────────────────

async def create_organization(user_id: int, req: OrgCreate) -> OrgResponse:
    slug = _slugify(req.name)
    if await fetchone("SELECT id FROM organizations WHERE slug=?", (slug,)):
        slug = f"{slug}-{secrets.token_hex(3)}"
    row_id = await execute(
        "INSERT INTO organizations (name,slug,description,avatar_url,owner_id) VALUES (?,?,?,?,?)",
        (req.name, slug, req.description, req.avatar_url, user_id))
    row = await fetchone("SELECT * FROM organizations WHERE id=?", (row_id,))
    return OrgResponse.from_db(row)  # type: ignore[arg-type]


async def list_organizations(user_id: int) -> list[OrgResponse]:
    rows = await fetchall(
        "SELECT * FROM organizations WHERE owner_id=? ORDER BY name", (user_id,))
    return [OrgResponse.from_db(r) for r in rows]

# ── Workspace CRUD ────────────────────────────────────────────────────────────

async def create_workspace(user_id: int, req: WorkspaceCreate) -> WorkspaceResponse:
    slug = _slugify(req.name)
    if await fetchone("SELECT id FROM workspaces WHERE slug=? AND (organization_id=? OR organization_id IS NULL)",
                      (slug, req.organization_id)):
        slug = f"{slug}-{secrets.token_hex(3)}"
    now = datetime.now(timezone.utc).isoformat()
    ws_id = await execute(
        "INSERT INTO workspaces (name,slug,description,avatar_url,owner_id,organization_id,updated_at)"
        " VALUES (?,?,?,?,?,?,?)",
        (req.name, slug, req.description, req.avatar_url, user_id, req.organization_id, now))
    await execute("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,?)",
                  (ws_id, user_id, "owner"))
    await _log(ws_id, user_id, "workspace.created", "workspace", ws_id)
    row = await fetchone("SELECT * FROM workspaces WHERE id=?", (ws_id,))
    return WorkspaceResponse.from_db(row, member_count=1)  # type: ignore[arg-type]


async def list_workspaces(user_id: int) -> WorkspaceListResponse:
    rows = await fetchall(
        "SELECT w.* FROM workspaces w"
        " JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=?"
        " ORDER BY w.updated_at DESC", (user_id,))
    items = [WorkspaceResponse.from_db(r, member_count=await _member_count(r["id"])) for r in rows]
    return WorkspaceListResponse(items=items, total=len(items))


async def get_workspace(workspace_id: int, user_id: int) -> WorkspaceResponse | None:
    await _assert_member(workspace_id, user_id)
    row = await fetchone("SELECT * FROM workspaces WHERE id=?", (workspace_id,))
    if not row:
        return None
    return WorkspaceResponse.from_db(row, member_count=await _member_count(workspace_id))


async def update_workspace(workspace_id: int, user_id: int,
                           req: WorkspaceUpdate) -> WorkspaceResponse:
    await _assert_permission(workspace_id, user_id, "manage")
    updates: list[str] = []
    params: list[Any] = []
    if req.name is not None:
        updates.append("name=?")
        params.append(req.name)
    if req.description is not None:
        updates.append("description=?")
        params.append(req.description)
    if req.avatar_url is not None:
        updates.append("avatar_url=?")
        params.append(req.avatar_url)
    if updates:
        updates.append("updated_at=?")
        params.append(datetime.now(timezone.utc).isoformat())
        params.append(workspace_id)
        await execute(f"UPDATE workspaces SET {', '.join(updates)} WHERE id=?", tuple(params))
    row = await fetchone("SELECT * FROM workspaces WHERE id=?", (workspace_id,))
    return WorkspaceResponse.from_db(row, member_count=await _member_count(workspace_id))  # type: ignore[arg-type]


async def delete_workspace(workspace_id: int, user_id: int) -> bool:
    if not await fetchone("SELECT id FROM workspaces WHERE id=? AND owner_id=?",
                          (workspace_id, user_id)):
        return False
    await execute("DELETE FROM workspaces WHERE id=?", (workspace_id,))
    return True

# ── Members ───────────────────────────────────────────────────────────────────

async def list_members(workspace_id: int, user_id: int) -> list[MemberResponse]:
    await _assert_member(workspace_id, user_id)
    rows = await fetchall(
        "SELECT m.*, u.username, u.email, u.avatar_url"
        " FROM workspace_members m JOIN users u ON u.id=m.user_id"
        " WHERE m.workspace_id=? ORDER BY m.joined_at", (workspace_id,))
    return [MemberResponse.from_db(r) for r in rows]


async def update_member_role(workspace_id: int, target_user_id: int,
                             req: RoleUpdate, acting_user_id: int) -> MemberResponse:
    await _assert_permission(workspace_id, acting_user_id, "manage")
    target = await fetchone(
        "SELECT * FROM workspace_members WHERE workspace_id=? AND user_id=?",
        (workspace_id, target_user_id))
    if not target:
        raise ValueError("User is not a member of this workspace")
    if target.get("role") == "owner" and req.role != "owner":
        raise ValueError("Cannot demote the workspace owner")
    await execute("UPDATE workspace_members SET role=? WHERE workspace_id=? AND user_id=?",
                  (req.role, workspace_id, target_user_id))
    await _log(workspace_id, acting_user_id, "member.role_changed", "user", target_user_id,
               {"new_role": req.role})
    await _notify(target_user_id, "role_changed", "Role updated",
                  f"Your role was changed to {req.role}", workspace_id)
    row = await fetchone(
        "SELECT m.*, u.username, u.email, u.avatar_url"
        " FROM workspace_members m JOIN users u ON u.id=m.user_id"
        " WHERE m.workspace_id=? AND m.user_id=?", (workspace_id, target_user_id))
    return MemberResponse.from_db(row)  # type: ignore[arg-type]


async def remove_member(workspace_id: int, target_user_id: int, acting_user_id: int) -> bool:
    await _assert_permission(workspace_id, acting_user_id, "manage")
    row = await fetchone("SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?",
                         (workspace_id, target_user_id))
    if not row:
        return False
    if row.get("role") == "owner":
        raise ValueError("Cannot remove the workspace owner")
    await execute("DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?",
                  (workspace_id, target_user_id))
    await _log(workspace_id, acting_user_id, "member.removed", "user", target_user_id)
    return True


async def transfer_ownership(workspace_id: int, new_owner_id: int,
                              acting_user_id: int) -> WorkspaceResponse:
    if not await fetchone("SELECT id FROM workspaces WHERE id=? AND owner_id=?",
                          (workspace_id, acting_user_id)):
        raise ValueError("Only the current owner can transfer ownership")
    await execute("UPDATE workspaces SET owner_id=? WHERE id=?", (new_owner_id, workspace_id))
    await execute("UPDATE workspace_members SET role='owner' WHERE workspace_id=? AND user_id=?",
                  (workspace_id, new_owner_id))
    await execute("UPDATE workspace_members SET role='admin' WHERE workspace_id=? AND user_id=?",
                  (workspace_id, acting_user_id))
    await _log(workspace_id, acting_user_id, "workspace.ownership_transferred", "user", new_owner_id)
    row = await fetchone("SELECT * FROM workspaces WHERE id=?", (workspace_id,))
    return WorkspaceResponse.from_db(row, member_count=await _member_count(workspace_id))  # type: ignore[arg-type]

# ── Invites ───────────────────────────────────────────────────────────────────

async def create_invite(workspace_id: int, user_id: int, req: InviteCreate) -> InviteResponse:
    await _assert_permission(workspace_id, user_id, "invite")
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    row_id = await execute(
        "INSERT INTO workspace_invites (workspace_id,invited_by,email,role,token,expires_at)"
        " VALUES (?,?,?,?,?,?)",
        (workspace_id, user_id, req.email, req.role, token, expires))
    await _log(workspace_id, user_id, "invite.created", "invite", row_id,
               {"email": req.email, "role": req.role})
    row = await fetchone("SELECT * FROM workspace_invites WHERE id=?", (row_id,))
    return InviteResponse.from_db(row)  # type: ignore[arg-type]


async def list_invites(workspace_id: int, user_id: int) -> list[InviteResponse]:
    await _assert_permission(workspace_id, user_id, "invite")
    rows = await fetchall(
        "SELECT * FROM workspace_invites WHERE workspace_id=? ORDER BY created_at DESC",
        (workspace_id,))
    return [InviteResponse.from_db(r) for r in rows]


async def accept_invite(token: str, user_id: int) -> WorkspaceResponse:
    now = datetime.now(timezone.utc).isoformat()
    inv = await fetchone(
        "SELECT * FROM workspace_invites WHERE token=? AND status='pending' AND expires_at>?",
        (token, now))
    if not inv:
        raise ValueError("Invite not found, already used, or expired")
    ws_id = inv["workspace_id"]
    if not await fetchone("SELECT id FROM workspace_members WHERE workspace_id=? AND user_id=?",
                          (ws_id, user_id)):
        await execute("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,?)",
                      (ws_id, user_id, inv["role"]))
    await execute("UPDATE workspace_invites SET status='accepted' WHERE id=?", (inv["id"],))
    await _log(ws_id, user_id, "member.joined", "user", user_id)
    await _notify(user_id, "invite_accepted", "Joined workspace",
                  "You have successfully joined the workspace", ws_id)
    row = await fetchone("SELECT * FROM workspaces WHERE id=?", (ws_id,))
    return WorkspaceResponse.from_db(row, member_count=await _member_count(ws_id))  # type: ignore[arg-type]


async def revoke_invite(invite_id: int, workspace_id: int, user_id: int) -> bool:
    await _assert_permission(workspace_id, user_id, "invite")
    if not await fetchone("SELECT id FROM workspace_invites WHERE id=? AND workspace_id=?",
                          (invite_id, workspace_id)):
        return False
    await execute("DELETE FROM workspace_invites WHERE id=?", (invite_id,))
    return True

# ── Repository mapping ────────────────────────────────────────────────────────

async def attach_repo(workspace_id: int, user_id: int, req: RepoAttach) -> WorkspaceRepoResponse:
    await _assert_permission(workspace_id, user_id, "manage")
    if await fetchone(
            "SELECT id FROM repositories_workspace"
            " WHERE workspace_id=? AND github_owner=? AND github_repo=?",
            (workspace_id, req.github_owner, req.github_repo)):
        raise ValueError("Repository already attached")
    row_id = await execute(
        "INSERT INTO repositories_workspace (workspace_id,github_owner,github_repo,added_by)"
        " VALUES (?,?,?,?)", (workspace_id, req.github_owner, req.github_repo, user_id))
    await _log(workspace_id, user_id, "repo.attached", "repository", row_id,
               {"repo": f"{req.github_owner}/{req.github_repo}"})
    row = await fetchone("SELECT * FROM repositories_workspace WHERE id=?", (row_id,))
    return WorkspaceRepoResponse.from_db(row)  # type: ignore[arg-type]


async def list_repos(workspace_id: int, user_id: int) -> list[WorkspaceRepoResponse]:
    await _assert_member(workspace_id, user_id)
    rows = await fetchall(
        "SELECT * FROM repositories_workspace WHERE workspace_id=? ORDER BY created_at",
        (workspace_id,))
    return [WorkspaceRepoResponse.from_db(r) for r in rows]


async def detach_repo(workspace_id: int, repo_id: int, user_id: int) -> bool:
    await _assert_permission(workspace_id, user_id, "manage")
    if not await fetchone("SELECT id FROM repositories_workspace WHERE id=? AND workspace_id=?",
                          (repo_id, workspace_id)):
        return False
    await execute("DELETE FROM repositories_workspace WHERE id=?", (repo_id,))
    await _log(workspace_id, user_id, "repo.detached", "repository", repo_id)
    return True

# ── Activity feed ─────────────────────────────────────────────────────────────

async def get_activity(workspace_id: int, user_id: int,
                       page: int = 1, page_size: int = 20) -> ActivityLogList:
    await _assert_member(workspace_id, user_id)
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    count_row = await fetchone(
        "SELECT COUNT(*) AS cnt FROM activity_logs WHERE workspace_id=?", (workspace_id,))
    total = (count_row or {}).get("cnt") or 0
    rows = await fetchall(
        "SELECT a.*, u.username, u.avatar_url"
        " FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id"
        " WHERE a.workspace_id=? ORDER BY a.created_at DESC LIMIT ? OFFSET ?",
        (workspace_id, page_size, (page - 1) * page_size))
    return ActivityLogList(
        items=[ActivityLogResponse.from_db(r) for r in rows],
        total=total, page=page, page_size=page_size,
        total_pages=max(math.ceil(total / page_size), 1))

# ── Notifications ─────────────────────────────────────────────────────────────

async def get_notifications(user_id: int, unread_only: bool = False) -> NotificationList:
    conds = ["user_id=?"]
    params: list[Any] = [user_id]
    if unread_only:
        conds.append("is_read=0")
    where = " AND ".join(conds)
    rows = await fetchall(
        f"SELECT * FROM notifications WHERE {where} ORDER BY created_at DESC LIMIT 50",
        tuple(params))
    unread_row = await fetchone(
        "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id=? AND is_read=0", (user_id,))
    total_row = await fetchone(
        f"SELECT COUNT(*) AS cnt FROM notifications WHERE {where}", tuple(params))
    return NotificationList(
        items=[NotificationResponse.from_db(r) for r in rows],
        unread_count=(unread_row or {}).get("cnt") or 0,
        total=(total_row or {}).get("cnt") or 0)


async def mark_notification_read(notification_id: int, user_id: int) -> bool:
    if not await fetchone("SELECT id FROM notifications WHERE id=? AND user_id=?",
                          (notification_id, user_id)):
        return False
    await execute("UPDATE notifications SET is_read=1 WHERE id=?", (notification_id,))
    return True


async def mark_all_read(user_id: int) -> None:
    await execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (user_id,))

# ── Dashboard ─────────────────────────────────────────────────────────────────

async def get_dashboard(workspace_id: int, user_id: int) -> WorkspaceDashboard:
    ws = await get_workspace(workspace_id, user_id)
    if not ws:
        raise ValueError("Workspace not found")
    members = await list_members(workspace_id, user_id)
    repos = await list_repos(workspace_id, user_id)
    activity = await get_activity(workspace_id, user_id, page=1, page_size=10)
    notifs = await get_notifications(user_id)
    reviews_row = await fetchone(
        "SELECT COUNT(*) AS cnt FROM reviews rv"
        " JOIN pull_requests pr ON pr.id=rv.pull_request_id"
        " JOIN repositories r ON r.id=pr.repository_id"
        " JOIN repositories_workspace rw"
        "   ON rw.github_owner=r.github_owner AND rw.github_repo=r.github_repo"
        "   AND rw.workspace_id=?", (workspace_id,))
    scans_row = await fetchone(
        "SELECT COUNT(*) AS cnt FROM security_scan_reports ssr"
        " JOIN repositories_workspace rw"
        "   ON rw.github_owner||'/'||rw.github_repo=ssr.repository"
        "   AND rw.workspace_id=?", (workspace_id,))
    stats = {
        "total_members": len(members),
        "total_repos": len(repos),
        "total_reviews": (reviews_row or {}).get("cnt") or 0,
        "total_scans": (scans_row or {}).get("cnt") or 0,
    }
    return WorkspaceDashboard(
        workspace=ws, members=members, repositories=repos,
        recent_activity=activity.items,
        unread_notifications=notifs.unread_count,
        stats=stats)
