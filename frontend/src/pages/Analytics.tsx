/**
 * Analytics Dashboard page.
 *
 * Layout (top → bottom):
 *   1. Header + filter bar (repo, tool, model, date range) + export buttons
 *   2. Summary metric cards (6 KPIs)
 *   3. Reviews-by-tool pie  +  trend area chart (tabbed daily/weekly/monthly)
 *   4. Repository analytics table
 *   5. Quality & security line-trend chart
 *   6. AI model usage bar chart
 *   7. Performance charts (radar + bar)
 *   8. Security distribution + top-repos-by-bugs
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import BugReportIcon from "@mui/icons-material/BugReport";
import DownloadIcon from "@mui/icons-material/Download";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import StarIcon from "@mui/icons-material/Star";
import StorageIcon from "@mui/icons-material/Storage";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";

import {
  MetricCard,
  ModelChart,
  PerformanceChart,
  RepoTable,
  SecurityChart,
  ToolPieChart,
  TrendChart,
} from "@/components/analytics";
import {
  useAnalyticsModels,
  useAnalyticsOverview,
  useAnalyticsPerformance,
  useAnalyticsRepositories,
  useAnalyticsSecurity,
  useAnalyticsTrends,
} from "@/hooks";
import { useRepositories } from "@/hooks";
import type { AnalyticsParams } from "@/types";

// ── CSV / JSON export helpers ─────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (v: string | number | null) =>
    v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

// ── Section wrapper ───────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

// ── Main component ────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  // ── Filter state ────────────────────────────────────────────────────────────
  const [repoFilter, setRepoFilter] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [trendPeriod, setTrendPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const params: AnalyticsParams = useMemo(
    () => ({
      ...(repoFilter ? { repo: repoFilter } : {}),
      ...(toolFilter ? { tool: toolFilter } : {}),
      ...(modelFilter ? { model: modelFilter } : {}),
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
    }),
    [repoFilter, toolFilter, modelFilter, dateFrom, dateTo],
  );

  const resetFilters = useCallback(() => {
    setRepoFilter("");
    setToolFilter("");
    setModelFilter("");
    setDateFrom("");
    setDateTo("");
  }, []);

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { data: repos } = useRepositories();
  const { data: overview, isLoading: ovLoading, isError: ovError } = useAnalyticsOverview(params);
  const { data: repoData, isLoading: repoLoading } = useAnalyticsRepositories(params);
  const { data: trends, isLoading: trendLoading } = useAnalyticsTrends(params);
  const { data: models, isLoading: modelLoading } = useAnalyticsModels(params);
  const { data: security, isLoading: secLoading } = useAnalyticsSecurity(params);
  const { data: perf, isLoading: perfLoading } = useAnalyticsPerformance(params);

  const anyLoading = ovLoading || repoLoading || trendLoading || modelLoading || secLoading || perfLoading;

  // ── Export helpers ──────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!repoData?.items.length) {
      enqueueSnackbar("No repository data to export", { variant: "info" });
      return;
    }
    const headers = [
      "Repository", "Reviews", "Avg Quality", "Avg Security",
      "Avg Time (s)", "Avg Bugs", "Last Reviewed",
    ];
    const rows = repoData.items.map((r) => [
      r.repo_label,
      r.review_count,
      r.avg_quality_score,
      r.avg_security_score,
      r.avg_review_time,
      r.avg_bugs_found,
      r.last_reviewed_date,
    ]);
    downloadBlob(toCSV(headers, rows), `analytics-repos-${dayjs().format("YYYY-MM-DD")}.csv`, "text/csv");
    enqueueSnackbar("CSV downloaded", { variant: "success", autoHideDuration: 2000 });
  };

  const exportJSON = () => {
    const payload = { overview, repositories: repoData?.items, trends, models: models?.items, security, performance: perf };
    downloadBlob(JSON.stringify(payload, null, 2), `analytics-${dayjs().format("YYYY-MM-DD")}.json`, "application/json");
    enqueueSnackbar("JSON downloaded", { variant: "success", autoHideDuration: 2000 });
  };

  // ── Trend series for selected period ───────────────────────────────────────
  const trendSeries = trends ? trends[trendPeriod] : [];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
          <AssessmentIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            Analytics
          </Typography>
          {anyLoading && <CircularProgress size={18} sx={{ ml: 1 }} />}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={exportCSV}>
            CSV
          </Button>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={exportJSON}>
            JSON
          </Button>
        </Stack>
      </Stack>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Repository */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel>Repository</InputLabel>
              <Select
                value={repoFilter}
                label="Repository"
                onChange={(e) => setRepoFilter(e.target.value)}
              >
                <MenuItem value="">All Repositories</MenuItem>
                {(repos ?? []).map((r) => (
                  <MenuItem key={r.id} value={`${r.github_owner}/${r.github_repo}`}>
                    {r.github_owner}/{r.github_repo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Tool */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Tool</InputLabel>
              <Select value={toolFilter} label="Tool" onChange={(e) => setToolFilter(e.target.value)}>
                <MenuItem value="">All Tools</MenuItem>
                <MenuItem value="review">Review</MenuItem>
                <MenuItem value="describe">Describe</MenuItem>
                <MenuItem value="improve">Improve</MenuItem>
                <MenuItem value="ask">Ask</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Model */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Model</InputLabel>
              <Select value={modelFilter} label="Model" onChange={(e) => setModelFilter(e.target.value)}>
                <MenuItem value="">All Models</MenuItem>
                {(models?.items ?? []).map((m) => (
                  <MenuItem key={m.model_name} value={m.model_name}>
                    {m.model_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Date from */}
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="From"
              type="date"
              size="small"
              fullWidth
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: dateTo || undefined }}
            />
          </Grid>

          {/* Date to */}
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="To"
              type="date"
              size="small"
              fullWidth
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: dateFrom || undefined }}
            />
          </Grid>

          {/* Reset */}
          <Grid item xs={12} sm={6} md={1}>
            <Button size="small" onClick={resetFilters} fullWidth>
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {ovError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load analytics data. Please try again.
        </Alert>
      )}

      {/* ── Summary KPI cards ──────────────────────────────────────────────── */}
      <Section title="Overview">
        <Grid container spacing={2}>
          <Grid item xs={6} sm={4} md={2}>
            <MetricCard
              icon={<AssessmentIcon fontSize="small" />}
              label="Total Reviews"
              value={overview?.total_reviews ?? 0}
              subtitle={overview?.latest_review_date ? `Last: ${dayjs(overview.latest_review_date).fromNow()}` : undefined}
              loading={ovLoading}
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <MetricCard
              icon={<StorageIcon fontSize="small" />}
              label="Repositories"
              value={overview?.repositories_analysed ?? 0}
              subtitle={`${overview?.pull_requests_reviewed ?? 0} PRs reviewed`}
              loading={ovLoading}
              color="success.main"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <MetricCard
              icon={<StarIcon fontSize="small" />}
              label="Avg Quality"
              value={overview?.avg_quality_score != null ? `${overview.avg_quality_score.toFixed(0)}/100` : null}
              loading={ovLoading}
              color="warning.main"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <MetricCard
              icon={<SecurityIcon fontSize="small" />}
              label="Avg Security"
              value={overview?.avg_security_score != null ? `${overview.avg_security_score.toFixed(0)}/100` : null}
              loading={ovLoading}
              color="info.main"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <MetricCard
              icon={<SpeedIcon fontSize="small" />}
              label="Avg Review Time"
              value={overview ? `${overview.avg_review_time.toFixed(1)}s` : null}
              subtitle={overview?.most_used_model ? `Model: ${overview.most_used_model}` : undefined}
              loading={ovLoading}
              color="secondary.main"
            />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <MetricCard
              icon={<BugReportIcon fontSize="small" />}
              label="Avg Bugs"
              value={overview?.avg_bugs_found != null ? overview.avg_bugs_found.toFixed(1) : null}
              subtitle={`${overview?.avg_suggestions?.toFixed(1) ?? "—"} avg suggestions`}
              loading={ovLoading}
              color="error.main"
            />
          </Grid>
        </Grid>
      </Section>

      <Divider sx={{ mb: 4 }} />

      {/* ── Tool distribution + Trend ──────────────────────────────────────── */}
      <Section title="Review Activity">
        <Grid container spacing={3}>
          {/* Pie chart */}
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1}>
                Reviews by Tool
              </Typography>
              {ovLoading ? (
                <Skeleton variant="circular" width={180} height={180} sx={{ mx: "auto" }} />
              ) : (
                <ToolPieChart data={overview?.reviews_by_tool ?? {}} />
              )}
            </Paper>
          </Grid>

          {/* Trend area chart */}
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  Review Volume
                </Typography>
                <ButtonGroup size="small" variant="outlined">
                  {(["daily", "weekly", "monthly"] as const).map((p) => (
                    <Button
                      key={p}
                      onClick={() => setTrendPeriod(p)}
                      variant={trendPeriod === p ? "contained" : "outlined"}
                      sx={{ textTransform: "capitalize", fontSize: 11 }}
                    >
                      {p}
                    </Button>
                  ))}
                </ButtonGroup>
              </Stack>
              {trendLoading ? (
                <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1 }} />
              ) : (
                <TrendChart data={trendSeries} variant="area" />
              )}
            </Paper>
          </Grid>
        </Grid>
      </Section>

      <Divider sx={{ mb: 4 }} />

      {/* ── Repository table ───────────────────────────────────────────────── */}
      <Section title="Repository Breakdown">
        {repoLoading ? (
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
        ) : (
          <RepoTable rows={repoData?.items ?? []} />
        )}
      </Section>

      <Divider sx={{ mb: 4 }} />

      {/* ── Quality & security trend ───────────────────────────────────────── */}
      <Section title="Quality & Security Trends">
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Score Trends
            </Typography>
            <ButtonGroup size="small" variant="outlined">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <Button
                  key={p}
                  onClick={() => setTrendPeriod(p)}
                  variant={trendPeriod === p ? "contained" : "outlined"}
                  sx={{ textTransform: "capitalize", fontSize: 11 }}
                >
                  {p}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
          {trendLoading ? (
            <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1 }} />
          ) : (
            <TrendChart data={trendSeries} variant="line" />
          )}
        </Paper>
      </Section>

      <Divider sx={{ mb: 4 }} />

      {/* ── AI Model usage ─────────────────────────────────────────────────── */}
      <Section title="AI Model Usage">
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          {modelLoading ? (
            <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1 }} />
          ) : (
            <ModelChart items={models?.items ?? []} />
          )}
        </Paper>
      </Section>

      <Divider sx={{ mb: 4 }} />

      {/* ── Performance ────────────────────────────────────────────────────── */}
      <Section title="Performance">
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          {perfLoading || !perf ? (
            <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1 }} />
          ) : (
            <PerformanceChart data={perf} />
          )}
        </Paper>

        {/* Performance stat row */}
        {perf && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[
              { label: "Fastest", value: `${perf.fastest_review.toFixed(2)}s`, color: "success.main" },
              { label: "Average", value: `${perf.avg_review_time.toFixed(2)}s`, color: "primary.main" },
              { label: "p95", value: `${perf.p95_review_time.toFixed(2)}s`, color: "warning.main" },
              { label: "Slowest", value: `${perf.slowest_review.toFixed(2)}s`, color: "error.main" },
              {
                label: "Total AI Time",
                value: `${perf.total_ai_processing_time.toFixed(1)}s`,
                color: "text.primary",
              },
            ].map(({ label, value, color }) => (
              <Grid item xs={6} sm={4} md={2} key={label}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {label}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color={color}>
                    {value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Section>

      <Divider sx={{ mb: 4 }} />

      {/* ── Security ───────────────────────────────────────────────────────── */}
      <Section title="Security Overview">
        {/* Security summary row */}
        {security && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              {
                label: "Avg Security Score",
                value: security.avg_security_score != null ? `${security.avg_security_score.toFixed(0)}/100` : "—",
                color: "info.main",
              },
              { label: "Total Bugs Found", value: security.total_bugs_found, color: "error.main" },
              { label: "Reviews with Bugs", value: security.reviews_with_bugs, color: "warning.main" },
              {
                label: "% Reviews with Bugs",
                value: `${security.pct_reviews_with_bugs.toFixed(1)}%`,
                color: "text.primary",
              },
            ].map(({ label, value, color }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {label}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color={color}>
                    {value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          {secLoading || !security ? (
            <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
          ) : (
            <SecurityChart data={security} />
          )}
        </Paper>
      </Section>
    </Box>
  );
};

export default Analytics;
