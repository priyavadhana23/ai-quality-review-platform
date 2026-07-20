/**
 * WorkspaceMembersPage — full member management + invite management.
 */
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider,
  Paper, Stack, Tab, Tabs, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { InviteDialog, MembersTable, RoleChip } from "@/components/workspace";
import {
  useCreateInvite, useRemoveMember, useRevokeInvite,
  useUpdateMemberRole, useWorkspace, useWorkspaceInvites, useWorkspaceMembers,
} from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks";
import type { WorkspaceRole } from "@/types";

dayjs.extend(relativeTime);

const WorkspaceMembersPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const wsId = id ? parseInt(id, 10) : null;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState<"members" | "invites">("members");
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: ws } = useWorkspace(wsId);
  const { data: members, isLoading: membersLoading } = useWorkspaceMembers(wsId);
  const { data: invites, isLoading: invitesLoading } = useWorkspaceInvites(wsId);

  const updateRole = useUpdateMemberRole(wsId ?? 0);
  const removeMember = useRemoveMember(wsId ?? 0);
  const createInvite = useCreateInvite(wsId ?? 0);
  const revokeInvite = useRevokeInvite(wsId ?? 0);

  if (!wsId) return <Alert severity="error">Invalid workspace ID.</Alert>;

  const currentMember = members?.find((m) => m.user_id === user?.id);
  const currentRole = currentMember?.role ?? "viewer";
  const canInvite = ["owner", "admin", "maintainer"].includes(currentRole);

  if (membersLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <Tooltip title="Back to workspace">
          <IconButton size="small" onClick={() => navigate(`/workspace/${wsId}`)}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" fontWeight={700}>
          {ws?.name ?? "Workspace"} — Members
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab value="members" label={`Members (${members?.length ?? 0})`} />
          <Tab value="invites" label={`Pending Invites (${invites?.filter((i) => i.status === "pending").length ?? 0})`} />
        </Tabs>
        {canInvite && (
          <Button variant="contained" startIcon={<PersonAddIcon />}
            onClick={() => setInviteOpen(true)} size="small">
            Invite Member
          </Button>
        )}
      </Stack>

      {tab === "members" && (
        <MembersTable
          members={members ?? []}
          isLoading={membersLoading}
          currentUserId={user?.id ?? 0}
          currentUserRole={currentRole}
          onRoleChange={(userId, role: WorkspaceRole) =>
            updateRole.mutate({ userId, req: { role } })}
          onRemove={(userId) => removeMember.mutate(userId)}
        />
      )}

      {tab === "invites" && (
        <Paper elevation={0}>
          {invitesLoading ? (
            <CircularProgress sx={{ m: 3 }} size={24} />
          ) : !invites || invites.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">No pending invitations.</Typography>
            </Box>
          ) : (
            <Box>
              {invites.map((inv) => (
                <Stack key={inv.id} direction="row" alignItems="center"
                  spacing={2} sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={500}>{inv.email}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <RoleChip role={inv.role} />
                      <Chip
                        label={inv.status}
                        size="small"
                        color={inv.status === "pending" ? "warning" : inv.status === "accepted" ? "success" : "default"}
                        sx={{ fontSize: 11 }}
                      />
                    </Stack>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Expires {dayjs(inv.expires_at).fromNow()}
                  </Typography>
                  {canInvite && inv.status === "pending" && (
                    <Tooltip title="Revoke invite">
                      <IconButton size="small" color="error"
                        onClick={() => revokeInvite.mutate(inv.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              ))}
            </Box>
          )}
        </Paper>
      )}

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={(req) => createInvite.mutate(req, { onSuccess: () => setInviteOpen(false) })}
        isLoading={createInvite.isPending}
      />
    </Box>
  );
};

export default WorkspaceMembersPage;
