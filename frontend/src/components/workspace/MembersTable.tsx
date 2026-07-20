/**
 * MembersTable — lists workspace members with role management and removal.
 */
import React from "react";
import {
  Avatar, Box, FormControl, IconButton, LinearProgress, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import type { WorkspaceMember, WorkspaceRole } from "@/types";
import { WORKSPACE_ROLE_LABELS } from "@/types";
import RoleChip from "./RoleChip";

const EDITABLE_ROLES: WorkspaceRole[] = ["admin", "maintainer", "developer", "qa_engineer", "viewer"];

interface MembersTableProps {
  members: WorkspaceMember[];
  isLoading: boolean;
  currentUserId: number;
  currentUserRole: string;
  onRoleChange: (userId: number, role: WorkspaceRole) => void;
  onRemove: (userId: number) => void;
}

const MembersTable: React.FC<MembersTableProps> = ({
  members, isLoading, currentUserId, currentUserRole, onRoleChange, onRemove,
}) => {
  const canManage = ["owner", "admin", "maintainer"].includes(currentUserRole);

  if (isLoading) return <LinearProgress />;

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Member</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Joined</TableCell>
            {canManage && <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const isOwner = m.role === "owner";
            return (
              <TableRow key={m.id} hover>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar src={m.avatar_url ?? undefined}
                      sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {m.username[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {m.username}
                        {isSelf && (
                          <Typography component="span" variant="caption"
                            color="text.secondary"> (you)</Typography>
                        )}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {m.email ?? "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  {canManage && !isOwner && !isSelf ? (
                    <FormControl size="small" variant="outlined" sx={{ minWidth: 130 }}>
                      <Select value={m.role}
                        onChange={(e) => onRoleChange(m.user_id, e.target.value as WorkspaceRole)}>
                        {EDITABLE_ROLES.map((r) => (
                          <MenuItem key={r} value={r}>{WORKSPACE_ROLE_LABELS[r]}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <RoleChip role={m.role} />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </Typography>
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    {!isOwner && !isSelf && (
                      <Tooltip title="Remove member">
                        <IconButton size="small" color="error"
                          onClick={() => onRemove(m.user_id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default MembersTable;
