import React, { useState } from "react";
import { Alert, Box, Divider, Grid, Paper, Stack, Typography } from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { useSnackbar } from "notistack";
import {
  AnalyzeForm,
  type AnalyzeFormValues,
  ErrorDialog,
  HealthIndicator,
  LoadingSpinner,
  ReviewCard,
} from "@/components";
import {
  useReviewMutation,
  useDescribeMutation,
  useImproveMutation,
  useAskMutation,
  useHistoryStore,
} from "@/hooks";
import type { ReviewHistoryEntry } from "@/types";

const Dashboard: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { entries } = useHistoryStore();
  const [latestEntry, setLatestEntry] = useState<ReviewHistoryEntry | null>(null);

  const reviewMutation = useReviewMutation();
  const describeMutation = useDescribeMutation();
  const improveMutation = useImproveMutation();
  const askMutation = useAskMutation();

  const activeMutation =
    reviewMutation.isPending ||
    describeMutation.isPending ||
    improveMutation.isPending ||
    askMutation.isPending;

  const activeError =
    reviewMutation.error || describeMutation.error || improveMutation.error || askMutation.error;

  const handleSubmit = async (values: AnalyzeFormValues) => {
    try {
      let result;
      if (values.tool === "review") {
        result = await reviewMutation.mutateAsync({ pr_url: values.pr_url });
      } else if (values.tool === "describe") {
        result = await describeMutation.mutateAsync({ pr_url: values.pr_url });
      } else if (values.tool === "improve") {
        result = await improveMutation.mutateAsync({ pr_url: values.pr_url });
      } else {
        result = await askMutation.mutateAsync({
          pr_url: values.pr_url,
          question: values.question ?? "",
        });
      }

      const entry: ReviewHistoryEntry = {
        id: crypto.randomUUID(),
        pr_url: values.pr_url,
        tool: values.tool,
        timestamp: new Date().toISOString(),
        execution_time: result.execution_time,
        output: result.data.output ?? "",
        question: values.question,
      };
      setLatestEntry(entry);
      enqueueSnackbar(`${values.tool} completed in ${result.execution_time.toFixed(1)}s`, {
        variant: "success",
        autoHideDuration: 4000,
      });
    } catch {
      // error already surfaced via activeError
    }
  };

  const dismissError = () => {
    reviewMutation.reset();
    describeMutation.reset();
    improveMutation.reset();
    askMutation.reset();
  };

  const recentEntries = entries.slice(0, 5);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <AutoFixHighIcon color="primary" />
            Pull Request Analyzer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI-powered code review, description generation, and improvement suggestions
          </Typography>
        </Box>
        <HealthIndicator />
      </Box>

      <Grid container spacing={3}>
        {/* Analyze Panel */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }} elevation={0}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Analyze a Pull Request
            </Typography>
            <Divider sx={{ mb: 2.5 }} />

            <AnalyzeForm onSubmit={handleSubmit} isLoading={activeMutation} />

            {/* Error */}
            <Box sx={{ mt: 2 }}>
              <ErrorDialog
                error={activeError as Error | null}
                onRetry={dismissError}
                onDismiss={dismissError}
              />
            </Box>

            {/* Loading */}
            {activeMutation && <LoadingSpinner />}
          </Paper>
        </Grid>

        {/* Stats Panel */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2.5 }} elevation={0}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                QUICK STATS
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between", py: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total analyses
                </Typography>
                <Typography variant="body2" fontWeight={700}>
                  {entries.length}
                </Typography>
              </Box>
              <Divider />
              {["review", "describe", "improve", "ask"].map((tool) => (
                <Box key={tool} sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textTransform: "capitalize" }}
                  >
                    {tool}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {entries.filter((e) => e.tool === tool).length}
                  </Typography>
                </Box>
              ))}
            </Paper>

            <Paper sx={{ p: 2.5 }} elevation={0}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                TOOLS
              </Typography>
              {[
                { tool: "review", desc: "Security, tests, effort", color: "#58a6ff" },
                { tool: "describe", desc: "PR title + description", color: "#3fb950" },
                { tool: "improve", desc: "Code suggestions", color: "#d29922" },
                { tool: "ask", desc: "Free-text Q&A", color: "#a371f7" },
              ].map((item) => (
                <Box
                  key={item.tool}
                  sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75 }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ textTransform: "capitalize" }}
                    >
                      {item.tool}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          </Stack>
        </Grid>

        {/* Latest Result */}
        {latestEntry && !activeMutation && (
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Latest Result
            </Typography>
            <ReviewCard entry={latestEntry} defaultExpanded />
          </Grid>
        )}

        {/* Recent History */}
        {recentEntries.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Recent Analyses
            </Typography>
            {recentEntries.map((entry) => (
              <ReviewCard key={entry.id} entry={entry} defaultExpanded={false} />
            ))}
          </Grid>
        )}

        {entries.length === 0 && !activeMutation && (
          <Grid item xs={12}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Paste a GitHub PR URL above and click <strong>Analyze</strong> to get started.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Dashboard;
