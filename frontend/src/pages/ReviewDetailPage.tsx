/**
 * ReviewDetailPage — full review detail view.
 *
 * Renders the complete markdown output alongside metadata, metrics,
 * and download buttons (Markdown + JSON).
 *
 * Route: /history/:id
 */
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BugReportIcon from "@mui/icons-material/BugReport";
import DownloadIcon from "@mui/icons-material/Download";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SecurityIcon from "@mui/icons-material/Security";
import StarIcon from "@mui/icons-material/Star";
import TimerIcon from "@mui/icons-material/Timer";
import dayjs from "dayjs";

import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useReviewDetail } from "@/hooks";
import type { ReviewDetail } from "@/types";

// ── Tool colour map ───────────────────────────────────────────────────────────

const TOOL_COLOR: Record<string, "primary" | "success" | "warning" | "info" | "default"> = {
  review: "primary",
  describe: "success",
  improve: "warning",
  ask: "info",
};

// ── Download helpers ──────────────────────────────────────────────────────────

function downloadMarkdown(review: ReviewDetail) {
  const filename = `review-${review.github_owner}-${review.github_repo}-PR${review.pr_number}-${review.id}.md`;
  const header = [
    `# PR Review — ${review.github_owner}/${review.github_repo} #${review.pr_number}`,
    "",
    `**Tool:** ${review.tool}  `,
    `**Model:** ${review.llm_model ?? "unknown"}  `,
    `**Execution time:** ${review.execution_time.toFixed(2)}s  `,
    `**Created:** ${dayjs(review.created_at).format("YYYY-MM-DD HH:mm")}  `,
    `**PR URL:** ${review.pr_url}`,
    "",
    "---",
    "",
  ].join("\n");

  const blob = new Blob([header + review.review_markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(review: ReviewDetail) {
  const filename = `review-${review.github_owner}-${review.github_repo}-PR${review.pr_number}-${review.id}.json`;
  const blob = new Blob([JSON.stringify(review, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null | undefined;
  unit?: string;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, unit = "", color = "text.primary" }) => (
  <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderRadius: 2 }}>
    <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
    <Typography variant="h5" fontWeight={700} color={color}>
      {value == null ? "—" : `${value}${unit}`}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Paper>
);

// ── Main component ────────────────────────────────────────────────────────────

const ReviewDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reviewId = id ? parseInt(id, 10) : null;

  const { data: review, isLoading, isError, error } = useReviewDetail(reviewId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !review) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/history")} sx={{ mb: 2 }}>
          Back to History
        </Button>
        <Alert severity="error">
          {isError ? (error as Error).message : "Review not found."}
        </Alert>
      </Box>
    );
  }

  const repoLabel = `${review.github_owner}/${review.github_repo}`;

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/history")} size="small">
          History
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary" fontFamily="monospace">
          {repoLabel} #{review.pr_number}
        </Typography>
        <Chip
          label={review.tool.toUpperCase()}
          color={TOOL_COLOR[review.tool] ?? "default"}
          size="small"
          sx={{ fontWeight: 700, fontSize: 10 }}
        />
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }} alignItems="flex-start">
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            {review.pr_title ?? `PR #${review.pr_number}`}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Typography
              variant="body2"
              component="a"
              href={review.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "primary.main",
                textDecoration: "none",
                fontFamily: "monospace",
                fontSize: 12,
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {review.pr_url}
            </Typography>
            <Tooltip title="Open PR in GitHub">
              <OpenInNewIcon
                fontSize="small"
                sx={{ color: "primary.main", cursor: "pointer", fontSize: 16 }}
                onClick={() => window.open(review.pr_url, "_blank", "noopener,noreferrer")}
              />
            </Tooltip>
          </Stack>
        </Box>

        {/* Download buttons */}
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => downloadMarkdown(review)}
          >
            Markdown
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => downloadJSON(review)}
          >
            JSON
          </Button>
        </Stack>
      </Stack>

      {/* ── Metadata row ────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary" display="block">
              Repository
            </Typography>
            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
              {repoLabel}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary" display="block">
              Model
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {review.llm_model ?? "—"}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <TimerIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">
                Execution time
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={600}>
              {review.execution_time.toFixed(2)}s
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary" display="block">
              Created
            </Typography>
            <Tooltip title={dayjs(review.created_at).format("YYYY-MM-DD HH:mm:ss")}>
              <Typography variant="body2" fontWeight={600}>
                {dayjs(review.created_at).format("MMM D, YYYY HH:mm")}
              </Typography>
            </Tooltip>
          </Grid>
          {review.branch && (
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary" display="block">
                Branch
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {review.branch}
              </Typography>
            </Grid>
          )}
          {review.author && (
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary" display="block">
                Author
              </Typography>
              <Typography variant="body2">{review.author}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* ── Metrics ─────────────────────────────────────────────────────── */}
      {review.metrics && (
        <>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Review Metrics
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<BugReportIcon />}
                label="Bugs Found"
                value={review.metrics.bugs_found}
                color="error.main"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<LightbulbIcon />}
                label="Suggestions"
                value={review.metrics.suggestions}
                color="warning.main"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<SecurityIcon />}
                label="Security Score"
                value={review.metrics.security_score}
                unit="/100"
                color="info.main"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<StarIcon />}
                label="Quality Score"
                value={review.metrics.quality_score}
                unit="/100"
                color="success.main"
              />
            </Grid>
          </Grid>
          <Divider sx={{ mb: 3 }} />
        </>
      )}

      {/* ── Markdown output ──────────────────────────────────────────────── */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Review Output
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <MarkdownRenderer content={review.review_markdown} />
      </Paper>
    </Box>
  );
};

export default ReviewDetailPage;
