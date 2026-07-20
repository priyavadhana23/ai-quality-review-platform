/**
 * WorkspacePage — dashboard view for a single workspace.
 *
 * Layout
 * ──────
 * 1. Header with workspace name + WorkspaceSwitcher
 * 2. Stats row (members, repos, reviews, scans)
 * 3. Two-column: Recent Activity | Repositories
 * 4. Members strip
 */
import React, { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  Grid, IconButton, Paper, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import SettingsIcon from "@mui/icons-material/Settings";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import {
  ActivityFeed, MembersTable, RoleChip, WorkspaceSwitcher,
} from "@/components/workspace";
import {
  useAttachRepo, useCreateWorkspace, useDetachRepo,
  useRemoveMember, useUpdateMemberRole, useWorkspaceDashboard, useWorkspaces,
} from "@/hooks/useWorkspace";
import type { WorkspaceCreate, WorkspaceRole, WorkspaceResponse } from "@/types";

dayjs.extend(relativeTime);

// ── Create workspace dialog ───────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
}
const CreateWorkspaceDialog: React.FC<CreateDialogProps> = ({ open, onClose }) => {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const { mutate, isPending } = useCreateWorkspace();
  const navigate = useNavigate();

  const handleCreate = () => {
    if (!name.trim()) return;
    const req: WorkspaceCreate = { name: name.trim(), description: desc.trim() || undefined };
    mutate(req, {
      onSuccess: (ws) => { onClose(); navigate(`/workspace/${ws.id}`); },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Workspace</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Workspace Name" value={name} onChange={(e) => setName(e.target.value)}
            fullWidth autoFocus disabled={isPending} />
          <TextField label="Description (optional)" value={desc}
            onChange={(e) => setDesc(e.target.value)}
            fullWidth multiline rows={2} disabled={isPending} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate}
          disabled={isPending || !name.trim()}>
          {isPending ? "Creating…" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Attach repo dialog ────────────────────────────────────────────────────────

interface AttachRepoDialogProps {
  workspaceId: number;
  open: boolean;
  onClose: () => void;
}
const AttachRepoDialog: React.FC<AttachRepoDialogProps> = ({ workspaceId, open, onClose }) => {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const { mutate, isPending } = useAttachRepo(workspaceId);

  const handleAttach = () => {
    if (!owner.trim() || !repo.trim()) return;
    mutate(
      { github_owner: owner.trim(), github_repo: repo.trim() },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Attach Repository</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="GitHub Owner" value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="octocat" fullWidth disabled={isPending} />
          <TextField label="Repository Name" value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="my-repo" fullWidth disabled={isPending} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="contained" onClick={handleAttach}
          disabled={isPending || !owner.trim() || !repo.trim()}>
          Attach
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <Card elevation={0} sx={{ borderLeft: `4px solid ${color ?? "#58a6ff"}` }}>
    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ color: color ?? "primary.main" }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </CardContent>
  </Card>
);

// ── Main page ─────────────────────────────────────────────────────────────────

const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const wsId = id ? parseInt(id, 10) : null;
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const { data: dashboard, isLoading, isError } = useWorkspaceDashboard(wsId);
  const { data: wsList } = useWorkspaces();
  const removeMember = useRemoveMember(wsId ?? 0);
  const updateRole = useUpdateMemberRole(wsId ?? 0);
  const detachRepo = useDetachRepo(wsId ?? 0);

  const handleSelectWorkspace = useCallback((ws: WorkspaceResponse) => {
    navigate(`/workspace/${ws.id}`);
  }, [navigate]);

  if (!wsId) {
    // No workspace selected — show empty state or list
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <GroupsIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Workspaces</Typography>
        </Stack>
        {wsList?.items.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: "center" }} elevation={0}>
            <GroupsIcon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" gutterBottom>No workspaces yet</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create your first workspace to collaborate with your team.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}>
              Create Workspace
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {wsList?.items.map((ws) => (
              <Grid item xs={12} sm={6} md={4} key={ws.id}>
                <Card elevation={0} sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                  onClick={() => navigate(`/workspace/${ws.id}`)}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700}>{ws.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{ws.description}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      {ws.member_count} member{ws.member_count !== 1 ? "s" : ""}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            <Grid item xs={12} sm={6} md={4}>
              <Card elevation={0} sx={{ cursor: "pointer", border: "2px dashed", borderColor: "divider",
                display: "flex", alignItems: "center", justifyContent: "center", minHeight: 100,
                "&:hover": { borderColor: "primary.main" } }}
                onClick={() => setCreateOpen(true)}>
                <Stack alignItems="center" spacing={0.5}>
                  <AddIcon color="disabled" />
                  <Typography variant="body2" color="text.secondary">New Workspace</Typography>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        )}
        <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !dashboard) {
    return <Alert severity="error">Failed to load workspace.</Alert>;
  }

  const { workspace: ws, members, repositories, recent_activity, stats } = dashboard;
  const currentMember = members.find((m) => m.user_id === ws.owner_id);
  const currentRole = currentMember?.role ?? "viewer";

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }}
        spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1 }}>
          <GroupsIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>{ws.name}</Typography>
          {ws.description && (
            <Typography variant="body2" color="text.secondary">— {ws.description}</Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <WorkspaceSwitcher activeId={wsId} onSelect={handleSelectWorkspace}
            onCreateNew={() => setCreateOpen(true)} />
          <Tooltip title="Manage members">
            <IconButton size="small" onClick={() => navigate(`/workspace/${wsId}/members`)}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard label="Members" value={stats.total_members} color="#58a6ff" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Repositories" value={stats.total_repos} color="#3fb950" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Reviews" value={stats.total_reviews} color="#d29922" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard label="Security Scans" value={stats.total_scans} color="#f85149" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* ── Activity feed ────────────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }} elevation={0}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              Recent Activity
            </Typography>
            <ActivityFeed items={recent_activity} maxItems={10} />
          </Paper>
        </Grid>

        {/* ── Repositories ─────────────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }} elevation={0}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>Repositories</Typography>
              <Button size="small" startIcon={<AddIcon />}
                onClick={() => setAttachOpen(true)}>
                Attach
              </Button>
            </Stack>
            {repositories.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No repositories attached yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {repositories.map((r) => (
                  <Stack key={r.id} direction="row" alignItems="center"
                    justifyContent="space-between"
                    sx={{ p: 1, borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {r.full_name}
                    </Typography>
                    <Tooltip title="Detach">
                      <IconButton size="small" color="error"
                        onClick={() => detachRepo.mutate(r.id)}>
                        <LinkOffIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* ── Members strip ─────────────────────────────────────────────── */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }} elevation={0}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>Members</Typography>
              <Button size="small" startIcon={<SettingsIcon fontSize="small" />}
                onClick={() => navigate(`/workspace/${wsId}/members`)}>
                Manage
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {members.map((m) => (
                <Chip key={m.id}
                  avatar={<Box component="span" sx={{
                    width: 20, height: 20, borderRadius: "50%",
                    bgcolor: "primary.main", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff",
                  }}>{m.username[0]?.toUpperCase()}</Box>}
                  label={m.username}
                  size="small"
                  variant="outlined"
                  sx={{ mb: 0.5 }}
                />
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <AttachRepoDialog workspaceId={wsId} open={attachOpen} onClose={() => setAttachOpen(false)} />
    </Box>
  );
};

export default WorkspacePage;
