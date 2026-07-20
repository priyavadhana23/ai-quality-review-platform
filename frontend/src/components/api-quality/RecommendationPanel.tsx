/**
 * RecommendationPanel — executive summary, strengths, weaknesses,
 * recommendations, and best practices from the AI analysis.
 */
import React from "react";
import {
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import type { ApiQualityAnalysis } from "@/types";

interface SectionProps {
  title: string;
  items: string[];
  icon: React.ReactNode;
  color: string;
}

const Section: React.FC<SectionProps> = ({ title, items, icon, color }) => {
  if (!items.length) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="subtitle2"
        fontWeight={600}
        color="text.secondary"
        sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
      >
        <Box sx={{ color, display: "flex" }}>{icon}</Box>
        {title}
        <Chip label={items.length} size="small" sx={{ ml: 0.5, fontSize: 10, height: 18 }} />
      </Typography>
      <List dense disablePadding>
        {items.map((item, i) => (
          <ListItem key={i} sx={{ py: 0.25, px: 0, alignItems: "flex-start" }}>
            <ListItemIcon sx={{ minWidth: 20, mt: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
            </ListItemIcon>
            <ListItemText
              primary={item}
              primaryTypographyProps={{
                variant: "body2",
                color: "text.secondary",
                lineHeight: 1.7,
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

interface RecommendationPanelProps {
  analysis: ApiQualityAnalysis;
}

const RecommendationPanel: React.FC<RecommendationPanelProps> = ({ analysis }) => (
  <Box>
    {analysis.executive_summary && (
      <Paper
        sx={{ p: 2.5, mb: 2.5, borderLeft: "4px solid", borderColor: "primary.main" }}
        elevation={0}
      >
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Executive Summary
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
          {analysis.executive_summary}
        </Typography>
      </Paper>
    )}

    <Section
      title="Strengths"
      items={analysis.strengths}
      icon={<CheckCircleOutlineIcon fontSize="small" />}
      color="#3fb950"
    />

    {analysis.strengths.length > 0 && analysis.weaknesses.length > 0 && (
      <Divider sx={{ my: 1.5 }} />
    )}

    <Section
      title="Weaknesses"
      items={analysis.weaknesses}
      icon={<ErrorOutlineIcon fontSize="small" />}
      color="#f85149"
    />

    {(analysis.weaknesses.length > 0 || analysis.strengths.length > 0) &&
      analysis.recommendations.length > 0 && <Divider sx={{ my: 1.5 }} />}

    <Section
      title="Recommendations"
      items={analysis.recommendations}
      icon={<TipsAndUpdatesIcon fontSize="small" />}
      color="#58a6ff"
    />

    {analysis.recommendations.length > 0 && analysis.best_practices.length > 0 && (
      <Divider sx={{ my: 1.5 }} />
    )}

    <Section
      title="Best Practices"
      items={analysis.best_practices}
      icon={<StarBorderIcon fontSize="small" />}
      color="#d29922"
    />
  </Box>
);

export default RecommendationPanel;
