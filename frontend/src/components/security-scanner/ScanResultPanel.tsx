/**
 * ScanResultPanel — full report view assembled from sub-components.
 *
 * Tabs: Overview | Findings | OWASP & CWE | Checklist
 */
import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import ArticleIcon from "@mui/icons-material/Article";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CodeIcon from "@mui/icons-material/Code";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import dayjs from "dayjs";

import FindingCard from "./FindingCard";
import OwaspBarChart from "./OwaspBarChart";
import SeverityPieChart from "./SeverityPieChart";
import type { FindingSeverity, SecurityScanReport } from "@/types";

// ── Score card ────────────────────────────────────────────────────────────────

function scoreColor(s: number | null): string {
  if (s == null) return "#8b949e";
  if (s >= 70) return "#3fb950";
  if (s >= 40) return "#d29922";
  return "#f85149";
}

// ── Checklist icon ────────────────────────────────────────────────────────────

const ChecklistIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === "fail") return <ErrorIcon fontSize="small" color="error" />;
  if (status === "warning") return <WarningIcon fontSize="small" color="warning" />;
  return <CheckCircleIcon fontSize="small" color="success" />;
};

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

function toMarkdown(report: SecurityScanReport): string {
  const { analysis } = report;
  const d = analysis.risk_distribution;

  const severityTable =
    `| Severity | Count |\n|----------|-------|\n` +
    `| 🔴 Critical | ${d.critical} |\n` +
    `| 🟠 High | ${d.high} |\n` +
    `| 🟡 Medium | ${d.medium} |\n` +
    `| ⚪ Low | ${d.low} |`;

  const findingBlocks = analysis.findings.map((f, i) =>
    [
      `### Finding ${i + 1}: ${f.title}`,
      `**Severity:** ${f.severity} | **CWE:** ${f.cwe_id || "—"} | **Confidence:** ${f.confidence}%`,
      f.owasp_category ? `**OWASP:** ${f.owasp_category}` : "",
      f.affected_file ? `**File:** \`${f.affected_file}\`` : "",
      f.affected_function ? `**Function:** \`${f.affected_function}\`` : "",
      "",
      f.description,
      "",
      f.risk_explanation ? `**Risk:** ${f.risk_explanation}` : "",
      f.recommendation ? `**Recommendation:** ${f.recommendation}` : "",
      f.secure_code_example
        ? `\n**Secure Code:**\n\`\`\`\n${f.secure_code_example}\n\`\`\``
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `# Security Scan Report`,
    `\n**Repository:** ${report.repository ?? "—"}  `,
    `**Scan Type:** ${report.scan_type}  `,
    `**Security Score:** ${report.overall_security_score?.toFixed(0) ?? "—"}/100  `,
    `**Generated:** ${dayjs(report.created_at).format("YYYY-MM-DD HH:mm")}`,
    `\n## Executive Summary\n${analysis.executive_summary}`,
    `\n## Risk Distribution\n${severityTable}`,
    analysis.top_risks.length
      ? `\n## Top Risks\n${analysis.top_risks.map((r) => `- ${r}`).join("\n")}`
      : "",
    analysis.recommendations.length
      ? `\n## Recommendations\n${analysis.recommendations.map((r) => `- ${r}`).join("\n")}`
      : "",
    analysis.findings.length ? `\n## Detailed Findings\n\n${findingBlocks.join("\n\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function toHTML(report: SecurityScanReport): string {
  const md = toMarkdown(report);
  // Minimal HTML wrapper — content already readable without a parser
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Security Scan Report — ${report.repository ?? "scan"}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #24292e; }
  pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { font-family: monospace; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e1e4e8; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; }
</style>
</head>
<body>
<pre>${md.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;
}

// ── Main component ────────────────────────────────────────────────────────────

const DETAIL_TABS = ["Overview", "Findings", "OWASP & CWE", "Checklist"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

interface ScanResultPanelProps {
  report: SecurityScanReport;
  onClose: () => void;
}

const ScanResultPanel: React.FC<ScanResultPanelProps> = ({ report, onClose }) => {
  const [tab, setTab] = useState<DetailTab>("Overview");
  const [sevFilter, setSevFilter] = useState<FindingSeverity | "all">("all");

  const { analysis } = report;
  const score = report.overall_security_score;
  const d = analysis.risk_distribution;

  const filteredFindings =
    sevFilter === "all"
      ? analysis.findings
      : analysis.findings.filter((f) => f.severity === sevFilter);

  const slug = (report.repository ?? "scan").replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {report.repository ?? "Security Scan"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {report.scan_type} scan
            {report.branch ? ` · ${report.branch}` : ""}
            {report.llm_model ? ` · ${report.llm_model}` : ""}
            {` · ${report.execution_time.toFixed(1)}s`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={() =>
              downloadBlob(JSON.stringify(report, null, 2), `${slug}-security.json`, "application/json")
            }
          >
            JSON
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ArticleIcon fontSize="small" />}
            onClick={() => downloadBlob(toMarkdown(report), `${slug}-security.md`, "text/markdown")}
          >
            Markdown
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CodeIcon fontSize="small" />}
            onClick={() => downloadBlob(toHTML(report), `${slug}-security.html`, "text/html")}
          >
            HTML
          </Button>
          <Button size="small" color="inherit" onClick={onClose}>
            Close
          </Button>
        </Stack>
      </Stack>

      {/* ── Score + severity summary ─────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card elevation={0} sx={{ textAlign: "center", borderLeft: `4px solid ${scoreColor(score)}` }}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
              <Typography
                variant="h3"
                fontWeight={700}
                sx={{ color: scoreColor(score), lineHeight: 1 }}
              >
                {score != null ? score.toFixed(0) : "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Security Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {[
          { label: "Critical", count: d.critical, color: "#f85149" },
          { label: "High", count: d.high, color: "#d29922" },
          { label: "Medium", count: d.medium, color: "#58a6ff" },
          { label: "Low", count: d.low, color: "#8b949e" },
        ].map(({ label, count, color }) => (
          <Grid item xs={6} sm={2} key={label}>
            <Card elevation={0} sx={{ textAlign: "center", borderLeft: `4px solid ${color}` }}>
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="h4" fontWeight={700} sx={{ color }}>
                  {count}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
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

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      {tab === "Overview" && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2 }} elevation={0}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Severity Distribution
              </Typography>
              <SeverityPieChart distribution={d} />
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
            {analysis.executive_summary && (
              <Paper
                sx={{ p: 2, mb: 2, borderLeft: "4px solid", borderColor: "error.main" }}
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
            {analysis.top_risks.length > 0 && (
              <Paper sx={{ p: 2 }} elevation={0}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Top Risks
                </Typography>
                <List dense disablePadding>
                  {analysis.top_risks.map((r, i) => (
                    <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 20 }}>
                        <Box
                          sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "error.main" }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={r}
                        primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Grid>
          {analysis.recommendations.length > 0 && (
            <Grid item xs={12}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Recommendations
              </Typography>
              <List dense disablePadding>
                {analysis.recommendations.map((r, i) => (
                  <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <Chip label={i + 1} size="small" sx={{ fontSize: 10, height: 18, minWidth: 24 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={r}
                      primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── Findings ──────────────────────────────────────────────────────── */}
      {tab === "Findings" && (
        <Box>
          {analysis.findings.length === 0 ? (
            <Alert severity="success">No security findings detected.</Alert>
          ) : (
            <>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {filteredFindings.length} of {analysis.findings.length} findings
                </Typography>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={sevFilter}
                    label="Severity"
                    onChange={(e) => setSevFilter(e.target.value as FindingSeverity | "all")}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              {filteredFindings.map((f, i) => (
                <FindingCard key={i} finding={f} index={i} />
              ))}
            </>
          )}
        </Box>
      )}

      {/* ── OWASP & CWE ──────────────────────────────────────────────────── */}
      {tab === "OWASP & CWE" && (
        <OwaspBarChart findings={analysis.findings} />
      )}

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      {tab === "Checklist" && (
        <Box>
          {analysis.secure_coding_checklist.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No checklist data available.
            </Typography>
          ) : (
            <List dense disablePadding>
              {analysis.secure_coding_checklist.map((item, i) => (
                <ListItem
                  key={i}
                  sx={{
                    px: 0,
                    py: 0.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <ChecklistIcon status={item.status} />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.item}
                    secondary={item.category}
                    primaryTypographyProps={{ variant: "body2" }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                  <Tooltip title={item.status}>
                    <Chip
                      label={item.status}
                      size="small"
                      color={
                        item.status === "fail"
                          ? "error"
                          : item.status === "warning"
                            ? "warning"
                            : "success"
                      }
                      sx={{ fontSize: 10 }}
                    />
                  </Tooltip>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default ScanResultPanel;
