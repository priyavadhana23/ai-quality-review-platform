/**
 * React Query hooks for Team Workspace & Collaboration.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { workspaceApi } from "@/api";
import type {
  InviteCreate,
  NotificationList,
  RepoAttach,
  RoleUpdate,
  WorkspaceCreate,
  WorkspaceDashboard,
  WorkspaceListResponse,
  WorkspaceResponse,
  WorkspaceUpdate,
} from "@/types";

export const WS_KEYS = {
  all: ["workspaces"] as const,
  lists: () => ["workspaces", "list"] as const,
  detail: (id: number) => ["workspaces", "detail", id] as const,
  dashboard: (id: number) => ["workspaces", "dashboard", id] as const,
  members: (id: number) => ["workspaces", "members", id] as const,
  invites: (id: number) => ["workspaces", "invites", id] as const,
  repos: (id: number) => ["workspaces", "repos", id] as const,
  activity: (id: number) => ["workspaces", "activity", id] as const,
  notifications: () => ["notifications"] as const,
} as const;

// ── Workspace list & detail ───────────────────────────────────────────────────

export function useWorkspaces() {
  return useQuery<WorkspaceListResponse, Error>({
    queryKey: WS_KEYS.lists(),
    queryFn: () => workspaceApi.list(),
    staleTime: 30_000,
  });
}

export function useWorkspace(id: number | null) {
  return useQuery<WorkspaceResponse, Error>({
    queryKey: WS_KEYS.detail(id!),
    queryFn: () => workspaceApi.get(id!),
    enabled: id !== null && id > 0,
    staleTime: 30_000,
  });
}

export function useWorkspaceDashboard(id: number | null) {
  return useQuery<WorkspaceDashboard, Error>({
    queryKey: WS_KEYS.dashboard(id!),
    queryFn: () => workspaceApi.dashboard(id!),
    enabled: id !== null && id > 0,
    staleTime: 15_000,
  });
}

// ── CRUD mutations ────────────────────────────────────────────────────────────

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<WorkspaceResponse, Error, WorkspaceCreate>({
    mutationFn: (req) => workspaceApi.create(req),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: WS_KEYS.lists() });
      enqueueSnackbar(`Workspace "${data.name}" created`, { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

export function useUpdateWorkspace(id: number) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<WorkspaceResponse, Error, WorkspaceUpdate>({
    mutationFn: (req) => workspaceApi.update(id, req),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: WS_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: WS_KEYS.lists() });
      enqueueSnackbar(`Workspace "${data.name}" updated`, { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<void, Error, number>({
    mutationFn: (id) => workspaceApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: WS_KEYS.lists() });
      qc.removeQueries({ queryKey: WS_KEYS.detail(id) });
      enqueueSnackbar("Workspace deleted", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

// ── Members ───────────────────────────────────────────────────────────────────

export function useWorkspaceMembers(id: number | null) {
  return useQuery({
    queryKey: WS_KEYS.members(id!),
    queryFn: () => workspaceApi.listMembers(id!),
    enabled: id !== null && id > 0,
    staleTime: 30_000,
  });
}

export function useUpdateMemberRole(workspaceId: number) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<unknown, Error, { userId: number; req: RoleUpdate }>({
    mutationFn: ({ userId, req }) => workspaceApi.updateRole(workspaceId, userId, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WS_KEYS.members(workspaceId) });
      enqueueSnackbar("Role updated", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

export function useRemoveMember(workspaceId: number) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<void, Error, number>({
    mutationFn: (userId) => workspaceApi.removeMember(workspaceId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WS_KEYS.members(workspaceId) });
      enqueueSnackbar("Member removed", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

// ── Invites ───────────────────────────────────────────────────────────────────

export function useWorkspaceInvites(id: number | null) {
  return useQuery({
    queryKey: WS_KEYS.invites(id!),
    queryFn: () => workspaceApi.listInvites(id!),
    enabled: id !== null && id > 0,
    staleTime: 30_000,
  });
}

export function useCreateInvite(workspaceId: number) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<unknown, Error, InviteCreate>({
    mutationFn: (req) => workspaceApi.createInvite(workspaceId, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WS_KEYS.invites(workspaceId) });
      enqueueSnackbar("Invitation sent", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

export function useRevokeInvite(workspaceId: number) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<void, Error, number>({
    mutationFn: (inviteId) => workspaceApi.revokeInvite(workspaceId, inviteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WS_KEYS.invites(workspaceId) });
      enqueueSnackbar("Invite revoked", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<WorkspaceResponse, Error, string>({
    mutationFn: (token) => workspaceApi.acceptInvite(token),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: WS_KEYS.lists() });
      enqueueSnackbar(`Joined workspace "${data.name}"`, { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

// ── Repos ─────────────────────────────────────────────────────────────────────

export function useWorkspaceRepos(id: number | null) {
  return useQuery({
    queryKey: WS_KEYS.repos(id!),
    queryFn: () => workspaceApi.listRepos(id!),
    enabled: id !== null && id > 0,
    staleTime: 30_000,
  });
}

export function useAttachRepo(workspaceId: number) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<unknown, Error, RepoAttach>({
    mutationFn: (req) => workspaceApi.attachRepo(workspaceId, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WS_KEYS.repos(workspaceId) });
      enqueueSnackbar("Repository attached", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

export function useDetachRepo(workspaceId: number) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<void, Error, number>({
    mutationFn: (repoId) => workspaceApi.detachRepo(workspaceId, repoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WS_KEYS.repos(workspaceId) });
      enqueueSnackbar("Repository detached", { variant: "success" });
    },
    onError: (err) => enqueueSnackbar(err.message, { variant: "error" }),
  });
}

// ── Activity ──────────────────────────────────────────────────────────────────

export function useWorkspaceActivity(id: number | null, page = 1) {
  return useQuery({
    queryKey: [...WS_KEYS.activity(id!), page],
    queryFn: () => workspaceApi.getActivity(id!, page),
    enabled: id !== null && id > 0,
    staleTime: 15_000,
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function useNotifications(unreadOnly = false) {
  return useQuery<NotificationList, Error>({
    queryKey: [...WS_KEYS.notifications(), unreadOnly],
    queryFn: () => workspaceApi.getNotifications(unreadOnly),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => workspaceApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: WS_KEYS.notifications() }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  return useMutation<void, Error, void>({
    mutationFn: () => workspaceApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WS_KEYS.notifications() });
      enqueueSnackbar("All notifications marked as read", { variant: "success" });
    },
  });
}
