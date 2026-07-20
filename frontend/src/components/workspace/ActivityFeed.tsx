/**
 * ActivityFeed — real-time workspace activity timeline.
 */
import React from "react";
import {
  Avatar, Box, LinearProgress, List, ListItem, ListItemAvatar,
  ListItemText, Paper, Typography,
} from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { ActivityLog } from "@/types";

dayjs.extend(relativeTime);

// Human-readable action labels
const ACTION_LABEL: Record<string, string> = {
  "workspace.created": "created the workspace",
  "workspace.ownership_transferred": "transferred ownership",
  "member.joined": "joined the workspace",
  "member.removed": "was removed",
  "member.role_changed": "had their role changed",
  "invite.created": "sent an invitation",
  "repo.attached": "attached a repository",
  "repo.detached": "detached a repository",
  "review.generated": "generated a review",
  "security.scanned": "ran a security scan",
  "test.generated": "generated tests",
  "report.generated": "generated a report",
};

interface ActivityFeedProps {
  items: ActivityLog[];
  isLoading?: boolean;
  maxItems?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ items, isLoading, maxItems = 20 }) => {
  if (isLoading) return <LinearProgress />;

  const visible = items.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }} elevation={0}>
        <Typography color="text.secondary" variant="body2">
          No activity yet.
        </Typography>
      </Paper>
    );
  }

  return (
    <List dense disablePadding>
      {visible.map((log) => {
        const label = ACTION_LABEL[log.action] ?? log.action.replace(/\./g, " ");
        const actor = log.username ?? "System";
        const meta = log.metadata as Record<string, string>;
        const detail = meta?.repo ?? meta?.email ?? meta?.new_role ?? "";
        return (
          <ListItem key={log.id} alignItems="flex-start"
            sx={{ px: 0, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
            <ListItemAvatar sx={{ minWidth: 36 }}>
              <Avatar src={log.avatar_url ?? undefined}
                sx={{ width: 28, height: 28, fontSize: 12 }}>
                {actor[0]?.toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box component="span">
                  <Typography component="span" variant="body2" fontWeight={600}>
                    {actor}
                  </Typography>
                  <Typography component="span" variant="body2" color="text.secondary">
                    {" "}{label}{detail ? ` — ${detail}` : ""}
                  </Typography>
                </Box>
              }
              secondary={dayjs(log.created_at).fromNow()}
              secondaryTypographyProps={{ variant: "caption" }}
            />
          </ListItem>
        );
      })}
    </List>
  );
};

export default ActivityFeed;
