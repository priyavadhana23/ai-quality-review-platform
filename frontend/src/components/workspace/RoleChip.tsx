import React from "react";
import { Chip } from "@mui/material";
import type { WorkspaceRole } from "@/types";
import { WORKSPACE_ROLE_COLORS, WORKSPACE_ROLE_LABELS } from "@/types";

interface RoleChipProps {
  role: string;
  size?: "small" | "medium";
}

const RoleChip: React.FC<RoleChipProps> = ({ role, size = "small" }) => (
  <Chip
    label={WORKSPACE_ROLE_LABELS[role as WorkspaceRole] ?? role}
    color={WORKSPACE_ROLE_COLORS[role as WorkspaceRole] ?? "default"}
    size={size}
    sx={{ fontWeight: 600, fontSize: 11 }}
  />
);

export default RoleChip;
