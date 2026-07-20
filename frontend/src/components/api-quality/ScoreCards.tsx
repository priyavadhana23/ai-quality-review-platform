/**
 * ScoreCards — 6 MUI cards showing each quality dimension score.
 */
import React from "react";
import { Box, Card, CardContent, Grid, Tooltip, Typography } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import DescriptionIcon from "@mui/icons-material/Description";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DesignServicesIcon from "@mui/icons-material/DesignServices";
import BuildIcon from "@mui/icons-material/Build";
import StarIcon from "@mui/icons-material/Star";
import type { ApiQualityScores } from "@/types";

interface ScoreCardsProps {
  scores: ApiQualityScores;
}

const SCORE_DIMS = [
  { key: "overall" as const, label: "Overall", icon: <StarIcon />, color: "#58a6ff", tooltip: "Composite quality score" },
  { key: "security" as const, label: "Security", icon: <SecurityIcon />, color: "#f85149", tooltip: "Auth, keys, OAuth scopes" },
  { key: "documentation" as const, label: "Docs", icon: <DescriptionIcon />, color: "#3fb950", tooltip: "Descriptions, examples, summaries" },
  { key: "validation" as const, label: "Validation", icon: <CheckCircleIcon />, color: "#d29922", tooltip: "Request/response schemas, types" },
  { key: "design" as const, label: "REST Design", icon: <DesignServicesIcon />, color: "#a371f7", tooltip: "Naming, HTTP methods, status codes" },
  { key: "maintainability" as const, label: "Maintainability", icon: <BuildIcon />, color: "#39c5cf", tooltip: "Versioning, conventions, consistency" },
];

function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "#8b949e";
  if (score >= 80) return "#3fb950";
  if (score >= 60) return "#d29922";
  return "#f85149";
}

function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(0);
}

const ScoreCards: React.FC<ScoreCardsProps> = ({ scores }) => (
  <Grid container spacing={2}>
    {SCORE_DIMS.map((dim) => {
      const val = scores[dim.key];
      const color = scoreColor(val);
      return (
        <Grid item xs={6} sm={4} md={2} key={dim.key}>
          <Tooltip title={dim.tooltip}>
            <Card
              elevation={0}
              sx={{
                height: "100%",
                borderLeft: `4px solid ${dim.color}`,
                textAlign: "center",
              }}
            >
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ color: dim.color, mb: 0.5, "& svg": { fontSize: 22 } }}>
                  {dim.icon}
                </Box>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{ color, lineHeight: 1.1, fontSize: { xs: 22, sm: 28 } }}
                >
                  {scoreLabel(val)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                  {dim.label}
                </Typography>
              </CardContent>
            </Card>
          </Tooltip>
        </Grid>
      );
    })}
  </Grid>
);

export default ScoreCards;
