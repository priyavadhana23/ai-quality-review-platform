"""
Team Workspace & Collaboration router.

All endpoints require a valid Bearer JWT.
Workspace-scoped endpoints enforce membership and role-based permissions
inside the service layer — users cannot access workspaces they don't belong to.

Routes
------
POST   /api/v1/workspaces                              create workspace
GET    /api/v1/workspaces                              list user workspaces
GET    /api/v1/workspaces/{id}                         get workspace
PUT    /api/v1/workspaces/{id}                         update workspace
DELETE /api/v1/workspaces/{id}                         delete workspace
GET    /api/v1/workspaces/{id}/dashboard               workspace dashboard
GET    /api/v1/workspaces/{id}/members                 list members
PUT    /api/v1/workspaces/{id}/members/{uid}/role      update role
DELETE /api/v1/workspaces/{id}/members/{uid}           remove member
POST   /api/v1/workspaces/{id}/transfer/{uid}          transfer ownership
POST   /api/v1/workspaces/{id}/invites                 create invite
GET    /api/v1/workspaces/{id}/invites                 list invites
DELETE /api/v1/workspaces/{id}/invites/{iid}           revoke invite
POST   /api/v1/workspaces/invites/accept               accept invite (token)
POST   /api/v1/workspaces/{id}/repos                   attach repo
GET    /api/v1/workspaces/{id}/repos                   list repos
DELETE /api/v1/workspaces/{id}/repos/{rid}             detach repo
GET    /api/v1/workspaces/{id}/activity                activity feed
GET    /api/v1/notifications                           user notifications
POST   /api/v1/notifications/{nid}/read                mark read
POST   /api/v1/notifications/read-all                  mark all read
POST   /api/v1/organizations                           create org
GET    /api/v1/organizations                           list orgs
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user
from app.schemas.common import ErrorResponse
from app.schemas.user import UserResponse
from app.schemas.workspace import (
    ActivityLogList, InviteCreate, InviteResponse, MemberResponse,
    NotificationList, OrgCreate, OrgResponse, RepoAttach, RoleUpdate,
    WorkspaceCreate, WorkspaceDashboard, WorkspaceListResponse,
    WorkspaceRepoResponse, WorkspaceResponse, WorkspaceUpdate,
)
from app.services import workspace_service

router = APIRouter(tags=["Workspaces"])

_401 = {401: {"model": ErrorResponse}}
_404 = {404: {"model": ErrorResponse, "description": "Not found"}}
_403 = {403: {"model": ErrorResponse, "description": "Forbidden"}}


def _dep(user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return user


# ── Organizations ─────────────────────────────────────────────────────────────

@router.post("/api/v1/organizations", response_model=OrgResponse,
             status_code=status.HTTP_201_CREATED, responses={**_401})
async def create_org(req: OrgCreate, user: UserResponse = Depends(_dep)) -> OrgResponse:
    return await workspace_service.create_organization(user.id, req)


@router.get("/api/v1/organizations", response_model=list[OrgResponse], responses={**_401})
async def list_orgs(user: UserResponse = Depends(_dep)) -> list[OrgResponse]:
    return await workspace_service.list_organizations(user.id)


# ── Workspaces ────────────────────────────────────────────────────────────────

@router.post("/api/v1/workspaces", response_model=WorkspaceResponse,
             status_code=status.HTTP_201_CREATED, responses={**_401})
async def create_workspace(req: WorkspaceCreate,
                           user: UserResponse = Depends(_dep)) -> WorkspaceResponse:
    return await workspace_service.create_workspace(user.id, req)


@router.get("/api/v1/workspaces", response_model=WorkspaceListResponse, responses={**_401})
async def list_workspaces(user: UserResponse = Depends(_dep)) -> WorkspaceListResponse:
    return await workspace_service.list_workspaces(user.id)


@router.get("/api/v1/workspaces/{workspace_id}",
            response_model=WorkspaceResponse, responses={**_401, **_404})
async def get_workspace(workspace_id: int,
                        user: UserResponse = Depends(_dep)) -> WorkspaceResponse:
    try:
        ws = await workspace_service.get_workspace(workspace_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.put("/api/v1/workspaces/{workspace_id}",
            response_model=WorkspaceResponse, responses={**_401, **_403, **_404})
async def update_workspace(workspace_id: int, req: WorkspaceUpdate,
                           user: UserResponse = Depends(_dep)) -> WorkspaceResponse:
    try:
        return await workspace_service.update_workspace(workspace_id, user.id, req)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.delete("/api/v1/workspaces/{workspace_id}",
               status_code=status.HTTP_204_NO_CONTENT, responses={**_401, **_404})
async def delete_workspace(workspace_id: int,
                           user: UserResponse = Depends(_dep)) -> None:
    deleted = await workspace_service.delete_workspace(workspace_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workspace not found or not owner")


@router.get("/api/v1/workspaces/{workspace_id}/dashboard",
            response_model=WorkspaceDashboard, responses={**_401, **_404})
async def get_dashboard(workspace_id: int,
                        user: UserResponse = Depends(_dep)) -> WorkspaceDashboard:
    try:
        return await workspace_service.get_dashboard(workspace_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


# ── Members ───────────────────────────────────────────────────────────────────

@router.get("/api/v1/workspaces/{workspace_id}/members",
            response_model=list[MemberResponse], responses={**_401, **_403})
async def list_members(workspace_id: int,
                       user: UserResponse = Depends(_dep)) -> list[MemberResponse]:
    try:
        return await workspace_service.list_members(workspace_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.put("/api/v1/workspaces/{workspace_id}/members/{target_user_id}/role",
            response_model=MemberResponse, responses={**_401, **_403, **_404})
async def update_role(workspace_id: int, target_user_id: int, req: RoleUpdate,
                      user: UserResponse = Depends(_dep)) -> MemberResponse:
    try:
        return await workspace_service.update_member_role(
            workspace_id, target_user_id, req, user.id)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.delete("/api/v1/workspaces/{workspace_id}/members/{target_user_id}",
               status_code=status.HTTP_204_NO_CONTENT, responses={**_401, **_403, **_404})
async def remove_member(workspace_id: int, target_user_id: int,
                        user: UserResponse = Depends(_dep)) -> None:
    try:
        removed = await workspace_service.remove_member(workspace_id, target_user_id, user.id)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    if not removed:
        raise HTTPException(status_code=404, detail="Member not found")


@router.post("/api/v1/workspaces/{workspace_id}/transfer/{new_owner_id}",
             response_model=WorkspaceResponse, responses={**_401, **_403})
async def transfer_ownership(workspace_id: int, new_owner_id: int,
                              user: UserResponse = Depends(_dep)) -> WorkspaceResponse:
    try:
        return await workspace_service.transfer_ownership(workspace_id, new_owner_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# ── Invites ───────────────────────────────────────────────────────────────────

@router.post("/api/v1/workspaces/{workspace_id}/invites",
             response_model=InviteResponse, status_code=status.HTTP_201_CREATED,
             responses={**_401, **_403})
async def create_invite(workspace_id: int, req: InviteCreate,
                        user: UserResponse = Depends(_dep)) -> InviteResponse:
    try:
        return await workspace_service.create_invite(workspace_id, user.id, req)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.get("/api/v1/workspaces/{workspace_id}/invites",
            response_model=list[InviteResponse], responses={**_401, **_403})
async def list_invites(workspace_id: int,
                       user: UserResponse = Depends(_dep)) -> list[InviteResponse]:
    try:
        return await workspace_service.list_invites(workspace_id, user.id)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.delete("/api/v1/workspaces/{workspace_id}/invites/{invite_id}",
               status_code=status.HTTP_204_NO_CONTENT, responses={**_401, **_403, **_404})
async def revoke_invite(workspace_id: int, invite_id: int,
                        user: UserResponse = Depends(_dep)) -> None:
    try:
        deleted = await workspace_service.revoke_invite(invite_id, workspace_id, user.id)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="Invite not found")


@router.post("/api/v1/workspaces/invites/accept",
             response_model=WorkspaceResponse, responses={**_401, 422: {"model": ErrorResponse}})
async def accept_invite(token: str = Query(..., description="Invite token"),
                        user: UserResponse = Depends(_dep)) -> WorkspaceResponse:
    try:
        return await workspace_service.accept_invite(token, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ── Repositories ──────────────────────────────────────────────────────────────

@router.post("/api/v1/workspaces/{workspace_id}/repos",
             response_model=WorkspaceRepoResponse, status_code=status.HTTP_201_CREATED,
             responses={**_401, **_403})
async def attach_repo(workspace_id: int, req: RepoAttach,
                      user: UserResponse = Depends(_dep)) -> WorkspaceRepoResponse:
    try:
        return await workspace_service.attach_repo(workspace_id, user.id, req)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.get("/api/v1/workspaces/{workspace_id}/repos",
            response_model=list[WorkspaceRepoResponse], responses={**_401, **_403})
async def list_repos(workspace_id: int,
                     user: UserResponse = Depends(_dep)) -> list[WorkspaceRepoResponse]:
    try:
        return await workspace_service.list_repos(workspace_id, user.id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


@router.delete("/api/v1/workspaces/{workspace_id}/repos/{repo_id}",
               status_code=status.HTTP_204_NO_CONTENT, responses={**_401, **_403, **_404})
async def detach_repo(workspace_id: int, repo_id: int,
                      user: UserResponse = Depends(_dep)) -> None:
    try:
        deleted = await workspace_service.detach_repo(workspace_id, repo_id, user.id)
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="Repository not found")


# ── Activity feed ─────────────────────────────────────────────────────────────

@router.get("/api/v1/workspaces/{workspace_id}/activity",
            response_model=ActivityLogList, responses={**_401, **_403})
async def get_activity(workspace_id: int,
                       page: int = Query(1, ge=1),
                       page_size: int = Query(20, ge=1, le=100),
                       user: UserResponse = Depends(_dep)) -> ActivityLogList:
    try:
        return await workspace_service.get_activity(workspace_id, user.id, page, page_size)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc))


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/api/v1/notifications", response_model=NotificationList, responses={**_401})
async def get_notifications(
        unread_only: bool = Query(False),
        user: UserResponse = Depends(_dep)) -> NotificationList:
    return await workspace_service.get_notifications(user.id, unread_only)


@router.post("/api/v1/notifications/{notification_id}/read",
             status_code=status.HTTP_204_NO_CONTENT, responses={**_401, **_404})
async def mark_read(notification_id: int, user: UserResponse = Depends(_dep)) -> None:
    ok = await workspace_service.mark_notification_read(notification_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")


@router.post("/api/v1/notifications/read-all",
             status_code=status.HTTP_204_NO_CONTENT, responses={**_401})
async def mark_all_read(user: UserResponse = Depends(_dep)) -> None:
    await workspace_service.mark_all_read(user.id)
