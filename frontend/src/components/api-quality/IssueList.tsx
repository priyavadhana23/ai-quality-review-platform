/**
 * IssueList — grouped display of critical issues and warnings.
 */
import React, { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import type { ApiIssue } from "@/types";

interface IssueListProps {
  criticalIssues: ApiIssue[];
  warnings: ApiIssue[];
}

const SEVERITY_CONFIG = {
  critical: { label: "Critical", color: "error" as const, icon: <ErrorIcon fontSize="small" /> },
  warning: { label: "Warning", color: "warning" as const, icon: <WarningIcon fontSize="small" /> },
  info: { label: "Info", color: "info" as const, icon: <WarningIcon fontSize="small" /> },
};

const CATEGORY_COLORS: Record<string, string> = {
  security: "#f85149",
  design: "#a371f7",
  documentation: "#3fb950",
  validation: "#d29922",
  other: "#8b949e",
};

interface IssueGroupProps {
  title: string;
  issues: ApiIssue[];
  defaultExpanded?: boolean;
}

const IssueGroup: React.FC<IssueGroupProps> = ({ title, issues, defaultExpanded = true }) => {
  if (issues.length === 0) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }} color="text.secondary">
        {title} <Chip label={issues.length} size="small" sx={{ ml: 0.5, fontSize: 11 }} />
      </Typography>
      {issues.map((issue, i) => {
        const sev = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.warning;
        const catColor = CATEGORY_COLORS[issue.category] ?? CATEGORY_COLORS.other;
        return (
          <Accordion key={i} elevation={0} disableGutters sx={{ mb: 0.5, "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ minHeight: 44 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1, mr: 1 }}>
                <Box sx={{ color: `${sev.color}.main`, display: "flex" }}>{sev.icon}</Box>
                <Typography variant="body2" fontWeight={500} sx={{ flexGrow: 1 }}>
                  {issue.title}
                </Typography>
                <Chip
                  label={issue.category}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 10, borderColor: catColor, color: catColor, height: 20 }}
                />
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {issue.description}
              </Typography>
              {issue.recommendation && (
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 1,
                    bgcolor: "background.default",
                    borderLeft: "3px solid",
                    borderColor: "primary.main",
                  }}
                >
                  <Typography variant="caption" fontWeight={600} color="primary.main" display="block">
                    Recommendation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {issue.recommendation}
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

const IssueList: React.FC<IssueListProps> = ({ criticalIssues, warnings }) => {
  if (criticalIssues.length === 0 && warnings.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No issues detected.
      </Typography>
    );
  }
  return (
    <Box>
      <IssueGroup title="Critical Issues" issues={criticalIssues} defaultExpanded />
      <IssueGroup title="Warnings" issues={warnings} defaultExpanded={false} />
    </Box>
  );
};

export default IssueList;
