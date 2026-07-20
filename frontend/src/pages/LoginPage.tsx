import React from "react";
import { Avatar, Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import BugReportIcon from "@mui/icons-material/BugReport";
import { useAuth } from "@/hooks";

const FEATURES = [
  { icon: <BugReportIcon fontSize="small" />, text: "AI-powered code review" },
  { icon: <SecurityIcon fontSize="small" />, text: "Security vulnerability detection" },
  { icon: <SpeedIcon fontSize="small" />, text: "Review effort estimation" },
  { icon: <AutoFixHighIcon fontSize="small" />, text: "Automated improvement suggestions" },
];

const LoginPage: React.FC = () => {
  const { login } = useAuth();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Stack spacing={3} alignItems="center" sx={{ width: "100%", maxWidth: 420 }}>
        {/* Logo + name */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
            <BugReportIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
              AI Quality Review
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Powered by PR-Agent + Gemini
            </Typography>
          </Box>
        </Stack>

        {/* Card */}
        <Paper sx={{ p: 4, width: "100%" }} elevation={0}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Sign in to continue
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Connect your GitHub account to start reviewing pull requests with AI.
          </Typography>

          <Button
            fullWidth
            size="large"
            variant="contained"
            startIcon={<GitHubIcon />}
            onClick={login}
            sx={{
              py: 1.5,
              bgcolor: "#238636",
              "&:hover": { bgcolor: "#2ea043" },
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Continue with GitHub
          </Button>

          <Divider sx={{ my: 3 }} />

          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            display="block"
            gutterBottom
          >
            WHAT YOU GET
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {FEATURES.map((f) => (
              <Stack key={f.text} direction="row" spacing={1} alignItems="center">
                <Box sx={{ color: "primary.main", display: "flex" }}>{f.icon}</Box>
                <Typography variant="body2" color="text.secondary">
                  {f.text}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>

        {/* Footer note */}
        <Stack direction="row" spacing={1} alignItems="center">
          <SecurityIcon sx={{ fontSize: 14, color: "text.disabled" }} />
          <Typography variant="caption" color="text.disabled">
            We only request read access to your GitHub profile. No write permissions.
          </Typography>
        </Stack>

        <Chip
          label="PR-Agent v0.39.0 · Gemini"
          size="small"
          variant="outlined"
          sx={{ fontSize: 11 }}
        />
      </Stack>
    </Box>
  );
};

export default LoginPage;
