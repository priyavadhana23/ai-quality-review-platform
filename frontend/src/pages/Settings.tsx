import React from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useThemeMode } from "@/theme/ThemeContext";
import { useHealth } from "@/hooks";

const Settings: React.FC = () => {
  const { mode, toggleMode } = useThemeMode();
  const { data: health, isPending, isError } = useHealth();

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <SettingsIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Settings
        </Typography>
      </Box>

      <Stack spacing={3} maxWidth={640}>
        {/* Theme */}
        <Paper sx={{ p: 3 }} elevation={0}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Appearance
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <FormControlLabel
            control={<Switch checked={mode === "dark"} onChange={toggleMode} color="primary" />}
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  Dark Mode
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  GitHub-inspired dark theme
                </Typography>
              </Box>
            }
          />
        </Paper>

        {/* Backend status */}
        <Paper sx={{ p: 3 }} elevation={0}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Backend Configuration
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {isPending ? (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Checking backend…
              </Typography>
            </Box>
          ) : isError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Cannot reach the backend. Ensure the FastAPI server is running on port 8000.
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>
              Backend is reachable.
            </Alert>
          )}

          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ color: "text.secondary", border: 0, pl: 0, width: "40%" }}>
                  API URL
                </TableCell>
                <TableCell sx={{ border: 0, fontFamily: "monospace", fontSize: 12 }}>
                  {import.meta.env.VITE_API_BASE_URL || "http://localhost:8000 (proxied)"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>Status</TableCell>
                <TableCell sx={{ border: 0 }}>
                  {isPending ? (
                    <Chip label="Checking" size="small" variant="outlined" />
                  ) : isError ? (
                    <Chip label="Offline" size="small" color="error" variant="outlined" />
                  ) : (
                    <Chip label="Online" size="small" color="success" variant="outlined" />
                  )}
                </TableCell>
              </TableRow>
              {health && (
                <>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>
                      API Version
                    </TableCell>
                    <TableCell sx={{ border: 0 }}>{health.version}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", border: 0, pl: 0 }}>Engine</TableCell>
                    <TableCell sx={{ border: 0 }}>{health.engine}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* App info */}
        <Paper sx={{ p: 3 }} elevation={0}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Application
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Table size="small">
            <TableBody>
              {[
                ["App Name", import.meta.env.VITE_APP_NAME ?? "AI Quality Review Platform"],
                ["Frontend Version", import.meta.env.VITE_APP_VERSION ?? "1.0.0"],
                ["Stack", "React 18 + TypeScript + MUI 6 + React Query 5"],
                ["Build Mode", import.meta.env.MODE],
              ].map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell sx={{ color: "text.secondary", border: 0, pl: 0, width: "40%" }}>
                    {key}
                  </TableCell>
                  <TableCell sx={{ border: 0, fontSize: 13 }}>{val}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    </Box>
  );
};

export default Settings;
