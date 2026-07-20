/**
 * ReportPreview — renders the generated report content and download buttons.
 * Markdown reports are displayed as plain pre-formatted text.
 * HTML reports are rendered in a sandboxed iframe.
 * JSON reports are displayed with syntax highlighting via a pre block.
 */
import React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import ArticleIcon from "@mui/icons-material/Article";
import CodeIcon from "@mui/icons-material/Code";
import DownloadIcon from "@mui/icons-material/Download";
import HtmlIcon from "@mui/icons-material/Html";
import dayjs from "dayjs";
import type { EngineeringHealthScore, GeneratedReport } from "@/types";
import { REPORT_FORMAT_LABELS, REPORT_TYPE_LABELS } from "@/types";

// ── Download helper ────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]/gi, "-").toLowerCase();
}

// ── Health score card ──────────────────────────────────────────────────────

function scoreColor(v: number | null): string {
  if (v == null) return "#8b949e";
  if (v >= 80) return "#3fb950";
  if (v >= 60) return "#d29922";
  return "#f85149";
}

const HealthCard: React.FC<{ health: EngineeringHealthScore }> = ({ health }) => (
  <Grid container spacing={2} sx={{ mb: 3 }}>
    {[
      { label: "Overall", value: health.overall },
      { label: "Reviews", value: health.review_coverage },
      { label: "Security", value: health.security_posture },
      { label: "API Quality", value: health.api_quality },
      { label: "Tests", value: health.test_coverage },
    ].map(({ label, value }) => (
      <Grid item xs={6} sm={4} md={2} key={label}>
        <Card
          elevation={0}
          sx={{ textAlign: "center", borderLeft: `4px solid ${scoreColor(value)}` }}
        >
          <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: scoreColor(value) }}>
              {value != null ? value.toFixed(0) : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    ))}
  </Grid>
);

// ── Main component ─────────────────────────────────────────────────────────

const CONTENT_TABS = ["Preview", "Raw"] as const;
type ContentTab = (typeof CONTENT_TABS)[number];

interface ReportPreviewProps {
  report: GeneratedReport;
  onClose: () => void;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ report, onClose }) => {
  const [tab, setTab] = React.useState<ContentTab>("Preview");
  const fmt = report.report_format;
  const fileSlug = slug(report.report_title || `report-${report.id}`);

  const mimeMap: Record<string, string> = {
    markdown: "text/markdown",
    html: "text/html",
    json: "application/json",
  };
  const extMap: Record<string, string> = { markdown: "md", html: "html", json: "json" };

  const handleDownload = () => {
    downloadBlob(
      report.report_content,
      `${fileSlug}.${extMap[fmt] ?? "txt"}`,
      mimeMap[fmt] ?? "text/plain",
    );
  };

  // Also offer other formats as derived downloads
  const handleDownloadMarkdown = () => {
    // report_content is already in the native format; for non-markdown just wrap it
    const content = fmt === "markdown" ? report.report_content
      : `# ${report.report_title}\n\n${report.summary ?? ""}`;
    downloadBlob(content, `${fileSlug}.md`, "text/markdown");
  };

  const handleDownloadJSON = () => {
    const data = report.payload ?? { report_title: report.report_title, summary: report.summary };
    downloadBlob(JSON.stringify(data, null, 2), `${fileSlug}.json`, "application/json");
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {report.report_title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
            <Chip
              label={REPORT_TYPE_LABELS[report.report_type as keyof typeof REPORT_TYPE_LABELS] ?? report.report_type}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={REPORT_FORMAT_LABELS[report.report_format as keyof typeof REPORT_FORMAT_LABELS] ?? report.report_format}
              size="small"
              variant="outlined"
            />
            {report.repository && (
              <Chip label={report.repository} size="small" variant="outlined" sx={{ fontFamily: "monospace", fontSize: 11 }} />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
              {dayjs(report.generated_at).format("YYYY-MM-DD HH:mm")}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button size="small" variant="contained" startIcon={<DownloadIcon fontSize="small" />} onClick={handleDownload}>
            {extMap[fmt]?.toUpperCase() ?? "Download"}
          </Button>
          {fmt !== "markdown" && (
            <Button size="small" variant="outlined" startIcon={<ArticleIcon fontSize="small" />} onClick={handleDownloadMarkdown}>
              MD
            </Button>
          )}
          {fmt !== "json" && (
            <Button size="small" variant="outlined" startIcon={<CodeIcon fontSize="small" />} onClick={handleDownloadJSON}>
              JSON
            </Button>
          )}
          <Button size="small" color="inherit" onClick={onClose}>Close</Button>
        </Stack>
      </Stack>

      {/* Engineering health score strip */}
      {report.payload?.engineering_health && (
        <HealthCard health={report.payload.engineering_health} />
      )}

      {/* Summary callout */}
      {report.summary && (
        <Paper
          elevation={0}
          sx={{ p: 2, mb: 2, borderLeft: "4px solid", borderColor: "primary.main", bgcolor: "action.hover" }}
        >
          <Typography variant="body2" color="text.secondary">{report.summary}</Typography>
        </Paper>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Content tabs */}
      <Tabs value={tab} onChange={(_, v: ContentTab) => setTab(v)} sx={{ mb: 2 }}>
        {CONTENT_TABS.map((t) => (
          <Tab key={t} value={t} label={t} />
        ))}
      </Tabs>

      {tab === "Preview" && (
        <>
          {fmt === "html" ? (
            <Box
              component="iframe"
              srcDoc={report.report_content}
              title="Report preview"
              sandbox="allow-same-origin"
              sx={{ width: "100%", minHeight: 600, border: "none", borderRadius: 1 }}
            />
          ) : fmt === "json" ? (
            <Box
              component="pre"
              sx={{
                m: 0, p: 2, borderRadius: 1, overflow: "auto",
                fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                bgcolor: (t) => t.palette.mode === "dark" ? "#0d1117" : "#f6f8fa",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              {report.report_content}
            </Box>
          ) : (
            <Box
              component="pre"
              sx={{
                m: 0, p: 2, borderRadius: 1, overflow: "auto",
                fontSize: 13, fontFamily: "monospace", whiteSpace: "pre-wrap",
                wordBreak: "break-word", lineHeight: 1.7,
                bgcolor: (t) => t.palette.mode === "dark" ? "#0d1117" : "#f6f8fa",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              {report.report_content}
            </Box>
          )}
        </>
      )}

      {tab === "Raw" && (
        <Box
          component="pre"
          sx={{
            m: 0, p: 2, borderRadius: 1, overflow: "auto",
            fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            bgcolor: (t) => t.palette.mode === "dark" ? "#0d1117" : "#f6f8fa",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {report.report_content}
        </Box>
      )}
    </Paper>
  );
};

export default ReportPreview;
