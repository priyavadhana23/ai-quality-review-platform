import React from "react";
import { Box, Chip, Divider, Grid, Link, Paper, Stack, Typography } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import BugReportIcon from "@mui/icons-material/BugReport";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import DescriptionIcon from "@mui/icons-material/Description";
import CodeIcon from "@mui/icons-material/Code";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";

const TOOLS = [
  {
    icon: <BugReportIcon />,
    name: "Review",
    endpoint: "POST /api/v1/review",
    desc: "AI-powered code review. Identifies security issues, missing tests, and estimates review effort.",
    color: "#58a6ff",
  },
  {
    icon: <DescriptionIcon />,
    name: "Describe",
    endpoint: "POST /api/v1/describe",
    desc: "Generates a structured PR title, summary, and file-by-file walkthrough from the diff.",
    color: "#3fb950",
  },
  {
    icon: <AutoFixHighIcon />,
    name: "Improve",
    endpoint: "POST /api/v1/improve",
    desc: "Produces inline code suggestions with before/after diffs ready to commit.",
    color: "#d29922",
  },
  {
    icon: <QuestionAnswerIcon />,
    name: "Ask",
    endpoint: "POST /api/v1/ask",
    desc: "Answers free-text questions about the PR diff using the configured AI model.",
    color: "#a371f7",
  },
];

const About: React.FC = () => (
  <Box>
    <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
      <InfoIcon color="primary" />
      <Typography variant="h5" fontWeight={700}>
        About
      </Typography>
    </Box>

    <Stack spacing={3} maxWidth={860}>
      <Paper sx={{ p: 3 }} elevation={0}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <BugReportIcon sx={{ color: "primary.main", fontSize: 32 }} />
          <Typography variant="h6" fontWeight={700}>
            AI Quality Review Platform
          </Typography>
          <Chip label="v1.0.0" size="small" variant="outlined" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
          A production-grade web application that exposes the{" "}
          <Link
            href="https://github.com/Codium-ai/pr-agent"
            target="_blank"
            rel="noopener noreferrer"
          >
            PR-Agent
          </Link>{" "}
          engine as REST APIs, with a modern React dashboard. Powered by Google Gemini via LiteLLM.
        </Typography>
      </Paper>

      <Typography variant="subtitle1" fontWeight={600}>
        Available Tools
      </Typography>
      <Grid container spacing={2}>
        {TOOLS.map((tool) => (
          <Grid item xs={12} sm={6} key={tool.name}>
            <Paper sx={{ p: 2.5 }} elevation={0}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <Box sx={{ color: tool.color }}>{tool.icon}</Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {tool.name}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                sx={{ fontFamily: "monospace", color: "primary.main", display: "block", mb: 1 }}
              >
                {tool.endpoint}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {tool.desc}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 3 }} elevation={0}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Architecture
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1}>
          {[
            ["Frontend", "React 18 · TypeScript · Vite · MUI 6 · React Query 5"],
            ["Backend", "FastAPI · Python 3.12 · Pydantic v2 · Uvicorn / Gunicorn"],
            ["AI Engine", "PR-Agent v0.39.0 (untouched)"],
            ["LLM", "Google Gemini 3.5 Flash via LiteLLM"],
            ["Auth", "GitHub PAT / GitHub App"],
          ].map(([layer, stack]) => (
            <Box key={layer} sx={{ display: "flex", gap: 2, alignItems: "baseline" }}>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ minWidth: 100, color: "text.secondary" }}
              >
                {layer}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12 }}>
                {stack}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }} elevation={0}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          API Reference
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <CodeIcon fontSize="small" sx={{ color: "primary.main", mt: 0.2 }} />
            <Box>
              <Typography variant="body2">
                Interactive Swagger UI:{" "}
                <Link href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">
                  http://localhost:8000/docs
                </Link>
              </Typography>
              <Typography variant="body2">
                ReDoc:{" "}
                <Link href="http://localhost:8000/redoc" target="_blank" rel="noopener noreferrer">
                  http://localhost:8000/redoc
                </Link>
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  </Box>
);

export default About;
