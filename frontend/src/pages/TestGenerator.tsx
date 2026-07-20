/**
 * TestGenerator page.
 *
 * Layout:
 *   1. Header
 *   2. TestForm — input panel (PR URL, language, framework, test type)
 *   3. Result panel — CodeViewer + quality analysis cards (shown after generation)
 *   4. History tab — TestHistoryTable of past generations
 */
import React, { useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import HistoryIcon from "@mui/icons-material/History";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ScienceIcon from "@mui/icons-material/Science";
import ShieldIcon from "@mui/icons-material/Shield";
import SpeedIcon from "@mui/icons-material/Speed";
import { useSnackbar } from "notistack";

import { CodeViewer, TestForm, TestHistoryTable } from "@/components/test-generator";
import { useGenerateTests, useTestDetail } from "@/hooks";
import type { GeneratedTestListItem, TestGenerateRequest } from "@/types";

// ── Risk colour helper ────────────────────────────────────────────────────────

const riskColor = (r: string | null): "success" | "warning" | "error" | "default" => {
  if (r === "low") return "success";
  if (r === "medium") return "warning";
  if (r === "high") return "error";
  return "default";
};

// ── Quality cards row ─────────────────────────────────────────────────────────

interface QualityCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color?: string;
}

const QualityCard: React.FC<QualityCardProps> = ({ icon, label, value, color = "text.primary" }) => (
  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: "center" }}>
    <Box sx={{ color, mb: 0.25 }}>{icon}</Box>
    <Typography variant="h6" fontWeight={700} color={color}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Paper>
);

// ── Main component ────────────────────────────────────────────────────────────

const TestGenerator: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);

  // ID of the currently-displayed result (from generate OR from history open)
  const [activeId, setActiveId] = useState<number | null>(null);

  const generateMutation = useGenerateTests();
  const { data: activeTest, isLoading: detailLoading } = useTestDetail(activeId);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = async (req: TestGenerateRequest) => {
    try {
      const result = await generateMutation.mutateAsync(req);
      setActiveId(result.id);
      setTab(0); // switch to Generate tab to show result
      enqueueSnackbar("Tests generated successfully!", { variant: "success", autoHideDuration: 3000 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      enqueueSnackbar(msg, { variant: "error" });
    }
  };

  const handleOpenFromHistory = (item: GeneratedTestListItem) => {
    setActiveId(item.id);
    setTab(0); // jump to viewer tab
  };

  // The result to display — prefer the freshly-generated object (has quality.missing_scenarios)
  // falling back to the detail query result
  const displayTest = generateMutation.data?.id === activeId ? generateMutation.data : activeTest;

  return (
    <Box>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <ScienceIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          AI Test Generator
        </Typography>
        <Chip label="Gemini" size="small" color="secondary" sx={{ ml: 1, fontWeight: 700 }} />
      </Box>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Generate" icon={<ScienceIcon fontSize="small" />} iconPosition="start" />
        <Tab label="History" icon={<HistoryIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 0 — Generate
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 0 && (
        <Box>
          {/* Input form */}
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Configure Test Generation
            </Typography>
            <TestForm onSubmit={handleGenerate} isLoading={generateMutation.isPending} />
          </Paper>

          {/* Error banner */}
          {generateMutation.isError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {generateMutation.error?.message ?? "An error occurred during generation."}
            </Alert>
          )}

          {/* Result — quality cards + code viewer */}
          {displayTest && (
            <>
              {/* Quality cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <QualityCard
                    icon={<SpeedIcon />}
                    label="Est. Coverage"
                    value={
                      displayTest.coverage_score != null
                        ? `${displayTest.coverage_score.toFixed(0)}%`
                        : "—"
                    }
                    color={
                      displayTest.coverage_score != null && displayTest.coverage_score >= 70
                        ? "success.main"
                        : "warning.main"
                    }
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <QualityCard
                    icon={<PsychologyIcon />}
                    label="AI Confidence"
                    value={
                      displayTest.confidence_score != null
                        ? `${displayTest.confidence_score.toFixed(0)}%`
                        : "—"
                    }
                    color="info.main"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <QualityCard
                    icon={<ShieldIcon />}
                    label="Risk Level"
                    value={
                      displayTest.risk_level ? (
                        <Chip
                          label={displayTest.risk_level}
                          size="small"
                          color={riskColor(displayTest.risk_level)}
                          sx={{ fontWeight: 700 }}
                        />
                      ) : (
                        "—"
                      )
                    }
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <QualityCard
                    icon={<BugReportIcon />}
                    label="Execution Time"
                    value={`${displayTest.execution_time.toFixed(1)}s`}
                    color="secondary.main"
                  />
                </Grid>
              </Grid>

              {/* Missing scenarios */}
              {displayTest.quality?.missing_scenarios &&
                displayTest.quality.missing_scenarios.length > 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Suggested additional test scenarios:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {displayTest.quality.missing_scenarios.map((s, i) => (
                        <li key={i}>
                          <Typography variant="body2">{s}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Alert>
                )}

              {/* Metadata strip */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                <Chip label={displayTest.language} size="small" color="primary" />
                <Chip label={displayTest.framework} size="small" variant="outlined" />
                <Chip
                  label={displayTest.test_type.replace("_", " ")}
                  size="small"
                  variant="outlined"
                />
                {displayTest.llm_model && (
                  <Chip label={displayTest.llm_model} size="small" variant="outlined" color="secondary" />
                )}
              </Stack>

              {/* Code viewer */}
              <CodeViewer
                code={displayTest.generated_code}
                language={displayTest.language}
                framework={displayTest.framework}
                prUrl={displayTest.pr_url}
                testId={displayTest.id}
              />
            </>
          )}

          {/* Placeholder when nothing has been generated yet */}
          {!displayTest && !generateMutation.isPending && (
            <Box
              sx={{
                border: "2px dashed",
                borderColor: "divider",
                borderRadius: 2,
                p: 6,
                textAlign: "center",
              }}
            >
              <ScienceIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography color="text.disabled">
                Fill in the form above and click <strong>Generate Tests</strong> to get started.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — History
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 1 && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Past Generations
          </Typography>
          <TestHistoryTable onOpen={handleOpenFromHistory} />
        </Box>
      )}
    </Box>
  );
};

export default TestGenerator;
