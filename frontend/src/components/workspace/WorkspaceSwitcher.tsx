/**
 * WorkspaceSwitcher — compact dropdown/button to switch between workspaces.
 */
import React, { useState } from "react";
import {
  Avatar, Box, Button, CircularProgress, Divider, ListItemAvatar,
  ListItemText, Menu, MenuItem, Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useWorkspaces } from "@/hooks/useWorkspace";
import type { WorkspaceResponse } from "@/types";

interface WorkspaceSwitcherProps {
  activeId: number | null;
  onSelect: (ws: WorkspaceResponse) => void;
  onCreateNew: () => void;
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ activeId, onSelect, onCreateNew }) => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { data, isLoading } = useWorkspaces();

  const active = data?.items.find((w) => w.id === activeId);

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<GroupsIcon fontSize="small" />}
        endIcon={<ExpandMoreIcon fontSize="small" />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ textTransform: "none", maxWidth: 220 }}
      >
        <Typography variant="body2" noWrap sx={{ maxWidth: 140 }}>
          {active?.name ?? "Select Workspace"}
        </Typography>
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        PaperProps={{ sx: { minWidth: 220 } }}>
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        {data?.items.map((ws) => (
          <MenuItem key={ws.id} selected={ws.id === activeId}
            onClick={() => { onSelect(ws); setAnchor(null); }}>
            <ListItemAvatar>
              <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: "primary.main" }}>
                {ws.name[0].toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={ws.name}
              secondary={`${ws.member_count} member${ws.member_count !== 1 ? "s" : ""}`}
              primaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
              secondaryTypographyProps={{ variant: "caption" }}
            />
          </MenuItem>
        ))}
        {(data?.items.length ?? 0) > 0 && <Divider />}
        <MenuItem onClick={() => { onCreateNew(); setAnchor(null); }}>
          <ListItemAvatar>
            <Avatar sx={{ width: 28, height: 28, bgcolor: "action.selected" }}>
              <AddIcon fontSize="small" />
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary="New Workspace"
            primaryTypographyProps={{ variant: "body2", color: "primary" }} />
        </MenuItem>
      </Menu>
    </>
  );
};

export default WorkspaceSwitcher;
