/**
 * API Quality Analyzer page.
 *
 * Layout
 * ──────
 * 1. Header
 * 2. UploadForm (file drag-and-drop OR URL)
 * 3. Report panel (shown after analysis or when viewing a history item)
 *    a. ScoreCards  — 6 dimension scores
 *    b. ScoreRadar  — radar + bar charts
 *    c. IssueList   — critical issues + warnings accordion
 *    d. EndpointTable — searchable per-endpoint grid
 *    e. RecommendationPanel — summary, strengths, weaknesses, recommendations
 *    f. Download JSON / Markdown buttons
 * 4. ReportHistoryTable — paginated history with view / delete / download
 */
import React, { useCallback, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ApiIcon from "@mui/icons-material/Api";
import DownloadIcon from "@mui/icons-material/Download";
import ArticleIcon from "@mui/icons-material/Article";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import {
  EndpointTable,
  IssueList,
  RecommendationPanel,
  ReportHistoryTable,
  ScoreCards,
  ScoreRadar,
  UploadForm,
} from "@/components/api-quality";
import {
  useAnalyzeApi,
  useApiHistory,
  useApiReport,
  useDeleteApiReport,
} from "@/hooks/useApiQuality";
import type { ApiQualityListItem, ApiQualityReport } from "@/types";

dayjs.extend(relativeTime);

// ── Download helpers ──────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function reportToMarkdown(report: ApiQualityReport): string {
  const { analysis, filename, spec_version, api_title, api_version, total_endpoints } = report;
  const s = analysis.scores;

  const scoreRow = (label: string, val: number | null | undefined) =>
    `| ${label} | ${val != null ? val.toFixed(0) : "—"} |`;

  const issueBlock = (issues: typeof analysis.critical_issues) =>
    issues
      .map(
        (i) =>
          `### ${i.title}\n**Severity:** ${i.severity} | **Category:** ${i.category}\n\n${i.description}\n\n**Recommendation:** ${i.recommendation}`,
      )
      .join("\n\n");

  return [
    `# API Quality Report — ${api_title ?? filename}`,
    `\n**Spec:** ${spec_version} ${api_version ? `v${api_version}` : ""}  `,
    `**Endpoints analysed:** ${total_endpoints}  `,
    `**Generated:** ${dayjs(report.created_at).format("YYYY-MM-DD HH:mm")}`,
    "\n## Executive Summary",
    analysis.executive_summary,
    "\n## Scores",
    "| Dimension | Score |",
    "|-----------|-------|",
    scoreRow("Overall", s.overall),
    scoreRow("Security", s.security),
    scoreRow("Documentation", s.documentation),
    scoreRow("Validation", s.validation),
    scoreRow("Design", s.design),
    scoreRow("Maintainability", s.maintainability),
    analysis.strengths.length
      ? `\n## Strengths\n${analysis.strengths.map((x) => `- ${x}`).join("\n")}`
      : "",
    analysis.weaknesses.length
      ? `\n## Weaknesses\n${analysis.weaknesses.map((x) => `- ${x}`).join("\n")}`
      : "",
    analysis.critical_issues.length
      ? `\n## Critical Issues\n\n${issueBlock(analysis.critical_issues)}`
      : "",
    analysis.warnings.length
      ? `\n## Warnings\n\n${issueBlock(analysis.warnings)}`
      : "",
    analysis.recommendations.length
      ? `\n## Recommendations\n${analysis.recommendations.map((x) => `- ${x}`).join("\n")}`
      : "",
    analysis.best_practices.length
      ? `\n## Best Practices\n${analysis.best_practices.map((x) => `- ${x}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Sub-component: active report panel ───────────────────────────────────────

interface ReportPanelProps {
  report: ApiQualityReport;
  onClose: () => void;
}

const DETAIL_TABS = ["Overview", "Issues", "Endpoints", "Recommendations"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

const ReportPanel: React.FC<ReportPanelProps> = ({ report, onClose }) => {
  const [tab, setTab] = useState<DetailTab>("Overview");

  const handleDownloadJSON = () => {
    const slug = (report.api_title ?? report.filename).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadBlob(JSON.stringify(report, null, 2), `${slug}-report.json`, "application/json");
  };

  const handleDownloadMarkdown = () => {
    const slug = (report.api_title ?? report.filename).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadBlob(reportToMarkdown(report), `${slug}-report.md`, "text/markdown");
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      {/* ── Report header ─────────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {report.api_title ?? report.filename}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {report.spec_version}
            {report.api_version ? ` · v${report.api_version}` : ""}
            {" · "}
            {report.total_endpoints} endpoints
            {report.llm_model ? ` · ${report.llm_model}` : ""}
            {" · "}
            {report.execution_time.toFixed(1)}s
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={handleDownloadJSON}
          >
            JSON
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ArticleIcon fontSize="small" />}
            onClick={handleDownloadMarkdown}
          >
            Markdown
          </Button>
          <Button size="small" color="inherit" onClick={onClose}>
            Close
          </Button>
        </Stack>
      </Stack>

      {/* ── Score cards (always visible) ──────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <ScoreCards scores={report.analysis.scores} />
      </Box>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <Tabs
        value={tab}
        onChange={(_, v: DetailTab) => setTab(v)}
        sx={{ mb: 2 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {DETAIL_TABS.map((t) => (
          <Tab key={t} value={t} label={t} />
        ))}
      </Tabs>

      {tab === "Overview" && <ScoreRadar scores={report.analysis.scores} />}

      {tab === "Issues" && (
        <IssueList
          criticalIssues={report.analysis.critical_issues}
          warnings={report.analysis.warnings}
        />
      )}

      {tab === "Endpoints" && <EndpointTable endpoints={report.analysis.endpoints} />}

      {tab === "Recommendations" && <RecommendationPanel analysis={report.analysis} />}
    </Paper>
  );
};

// ── History-item viewer (fetches full report by id) ───────────────────────────

interface HistoryViewerProps {
  reportId: number;
  onClose: () => void;
}

const HistoryViewer: React.FC<HistoryViewerProps> = ({ reportId, onClose }) => {
  const { data, isLoading, isError } = useApiReport(reportId);

  if (isLoading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  if (isError || !data)
    return (
      <Alert severity="error" action={<Button onClick={onClose}>Close</Button>}>
        Failed to load report.
      </Alert>
    );

  return <ReportPanel report={data} onClose={onClose} />;
};

// ── Main page ─────────────────────────────────────────────────────────────────

const ApiQualityPage: React.FC = () => {
  // ── State ───────────────────────────────────────────────────────────────────
  const [activeReport, setActiveReport] = useState<ApiQualityReport | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(20);

  // ── Mutations / queries ─────────────────────────────────────────────────────
  const analyzeMutation = useAnalyzeApi();
  const deleteMutation = useDeleteApiReport();
  const { data: historyData, isLoading: histLoading } = useApiHistory({
    page: histPage,
    page_size: histPageSize,
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(
    (payload: { file: File } | { specUrl: string }) => {
      setActiveReport(null);
      setViewingId(null);
      analyzeMutation.mutate(payload, {
        onSuccess: (report) => {
          setActiveReport(report);
          setViewingId(null);
        },
      });
    },
    [analyzeMutation],
  );

  const handleView = useCallback((id: number) => {
    setActiveReport(null);
    setViewingId(id);
    // Scroll to report panel
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCloseReport = useCallback(() => {
    setActiveReport(null);
    setViewingId(null);
  }, []);

  const handleDelete = useCallback(
    (id: number) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          // If we were viewing the deleted report, close it
          if (viewingId === id) handleCloseReport();
        },
      });
    },
    [deleteMutation, viewingId, handleCloseReport],
  );

  const handleDownloadListItem = useCallback((item: ApiQualityListItem) => {
    // Download what we have (list-item level — no analysis_json)
    const slug = (item.api_title ?? item.filename).replace(/[^a-z0-9]/gi, "-").toLowerCase();
    downloadBlob(JSON.stringify(item, null, 2), `${slug}-summary.json`, "application/json");
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <ApiIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          API Quality Analyzer
        </Typography>
      </Stack>

      {/* ── Upload form ──────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <UploadForm onAnalyze={handleAnalyze} isLoading={analyzeMutation.isPending} />
      </Box>

      {/* ── Mutation error ────────────────────────────────────────────────── */}
      {analyzeMutation.isError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => analyzeMutation.reset()}>
          {analyzeMutation.error?.message ?? "Analysis failed. Please try again."}
        </Alert>
      )}

      {/* ── Active report (fresh analysis result) ──────────────────────── */}
      {activeReport && (
        <Box sx={{ mb: 3 }}>
          <ReportPanel report={activeReport} onClose={handleCloseReport} />
        </Box>
      )}

      {/* ── History-item viewer ───────────────────────────────────────────── */}
      {viewingId !== null && !activeReport && (
        <Box sx={{ mb: 3 }}>
          <HistoryViewer reportId={viewingId} onClose={handleCloseReport} />
        </Box>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* ── Report history ───────────────────────────────────────────────── */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
        Report History
      </Typography>
      <ReportHistoryTable
        data={historyData}
        isLoading={histLoading}
        page={histPage}
        pageSize={histPageSize}
        onPageChange={setHistPage}
        onPageSizeChange={(s) => { setHistPageSize(s); setHistPage(1); }}
        onView={handleView}
        onDelete={handleDelete}
        onDownload={handleDownloadListItem}
      />
    </Box>
  );
};

export default ApiQualityPage;
