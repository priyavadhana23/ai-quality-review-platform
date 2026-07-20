/**
 * NotificationCenter — bell icon with dropdown notification list.
 */
import React, { useState } from "react";
import {
  Badge, Box, Button, Divider, IconButton, List, ListItem, ListItemText,
  Paper, Popover, Stack, Tooltip, Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CheckIcon from "@mui/icons-material/Check";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/useWorkspace";

dayjs.extend(relativeTime);

const NOTIF_ICONS: Record<string, string> = {
  invite_accepted: "✅",
  role_changed: "🔄",
  review_complete: "📋",
  security_complete: "🔒",
  report_complete: "📄",
};

const NotificationCenter: React.FC = () => {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { data } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const unread = data?.unread_count ?? 0;
  const items = data?.items ?? [];

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} size="small">
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 340, maxHeight: 480 } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>Notifications</Typography>
          {unread > 0 && (
            <Button size="small" startIcon={<CheckIcon fontSize="small" />}
              onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          )}
        </Stack>
        <Divider />

        {items.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ overflow: "auto", maxHeight: 380 }}>
            {items.map((n) => (
              <ListItem
                key={n.id}
                alignItems="flex-start"
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                sx={{
                  cursor: n.is_read ? "default" : "pointer",
                  bgcolor: n.is_read ? "transparent" : "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography component="span" variant="caption">
                        {NOTIF_ICONS[n.type] ?? "🔔"}
                      </Typography>
                      <Typography component="span" variant="body2" fontWeight={n.is_read ? 400 : 600}>
                        {n.title}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {n.body}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {dayjs(n.created_at).fromNow()}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
};

export default NotificationCenter;
