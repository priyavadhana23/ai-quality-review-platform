import React from "react";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import PersonIcon from "@mui/icons-material/Person";
import dayjs from "dayjs";
import { useAuth } from "@/hooks";

const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  const rows = [
    ["Username", user.username],
    ["Email", user.email ?? "—"],
    ["Role", user.role],
    ["GitHub ID", String(user.github_id)],
    ["Member since", dayjs(user.created_at).format("MMMM D, YYYY")],
    ["Last login", dayjs(user.last_login).format("MMMM D, YYYY HH:mm")],
  ];

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <PersonIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Profile
        </Typography>
      </Box>

      <Stack spacing={3} maxWidth={560}>
        {/* Avatar + name */}
        <Paper sx={{ p: 3 }} elevation={0}>
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Avatar
              src={user.avatar_url ?? undefined}
              alt={user.username}
              sx={{ width: 72, height: 72, border: "2px solid", borderColor: "primary.main" }}
            />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {user.username}
              </Typography>
              {user.email && (
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                <Chip
                  label={user.role}
                  size="small"
                  color={user.role === "admin" ? "warning" : "primary"}
                  variant="outlined"
                />
                <Chip
                  icon={<GitHubIcon sx={{ fontSize: "14px !important" }} />}
                  label="GitHub"
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {/* Details table */}
        <Paper sx={{ p: 3 }} elevation={0}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Account Details
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Table size="small">
            <TableBody>
              {rows.map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell
                    sx={{ color: "text.secondary", border: 0, pl: 0, width: "40%", py: 0.75 }}
                  >
                    {label}
                  </TableCell>
                  <TableCell
                    sx={{
                      border: 0,
                      py: 0.75,
                      fontFamily: label === "GitHub ID" ? "monospace" : "inherit",
                    }}
                  >
                    {value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* GitHub link */}
        <Paper sx={{ p: 3 }} elevation={0}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            GitHub Account
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Link
            href={`https://github.com/${user.username}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <GitHubIcon fontSize="small" />
            github.com/{user.username}
          </Link>
        </Paper>
      </Stack>
    </Box>
  );
};

export default ProfilePage;
