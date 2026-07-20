/**
 * FindingCard — collapsible accordion card for a single security finding.
 * Shows severity chip, OWASP category, CWE ID, affected location,
 * description, risk explanation, recommendation, and secure code example.
 */
import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SecurityFinding } from "@/types";

// ── Severity config ───────────────────────────────────────────────────────────

const SEV_CONFIG: Record<
  string,
  { color: "error" | "warning" | "info" | "default"; bg: string; darkBg: string }
> = {
  critical: { color: "error", bg: "#fff1f0", darkBg: "#2d0a0a" },
  high: { color: "warning", bg: "#fff7e6", darkBg: "#2d1a00" },
  medium: { color: "info", bg: "#f0f9ff", darkBg: "#001d2d" },
  low: { color: "default", bg: "#f6f8fa", darkBg: "#161b22" },
};

interface FindingCardProps {
  finding: SecurityFinding;
  index: number;
}

const FindingCard: React.FC<FindingCardProps> = ({ finding, index }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const sev = SEV_CONFIG[finding.severity] ?? SEV_CONFIG.low;

  return (
    <Accordion
      elevation={0}
      disableGutters
      sx={{
        mb: 1,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: "8px !important",
        "&:before": { display: "none" },
        bgcolor: isDark ? sev.darkBg : sev.bg,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ minHeight: 52 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1, mr: 1 }}>
          <Typography variant="caption" color="text.disabled" sx={{ minWidth: 20 }}>
            #{index + 1}
          </Typography>
          <Chip
            label={finding.severity.toUpperCase()}
            size="small"
            color={sev.color}
            sx={{ fontWeight: 700, fontSize: 11, minWidth: 72 }}
          />
          <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
            {finding.title || "Untitled Finding"}
          </Typography>
          {finding.cwe_id && (
            <Chip
              label={finding.cwe_id}
              size="small"
              variant="outlined"
              sx={{ fontSize: 10, fontFamily: "monospace" }}
            />
          )}
          {finding.confidence > 0 && (
            <Typography variant="caption" color="text.secondary">
              {finding.confidence.toFixed(0)}% conf.
            </Typography>
          )}
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        {/* Location */}
        {(finding.affected_file || finding.affected_function) && (
          <Box
            sx={{
              mb: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: "background.default",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          >
            {finding.affected_file && (
              <Typography variant="caption" color="text.secondary" display="block">
                📁 {finding.affected_file}
              </Typography>
            )}
            {finding.affected_function && (
              <Typography variant="caption" color="text.secondary" display="block">
                ƒ {finding.affected_function}
              </Typography>
            )}
          </Box>
        )}

        {/* OWASP */}
        {finding.owasp_category && (
          <Box sx={{ mb: 1.5 }}>
            <Chip
              label={finding.owasp_category}
              size="small"
              variant="outlined"
              color="error"
              sx={{ fontSize: 11 }}
            />
          </Box>
        )}

        {/* Description */}
        {finding.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
            {finding.description}
          </Typography>
        )}

        {/* Risk explanation */}
        {finding.risk_explanation && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 1, bgcolor: "background.default", borderLeft: "3px solid", borderColor: "error.main" }}>
            <Typography variant="caption" fontWeight={700} color="error.main" display="block" sx={{ mb: 0.5 }}>
              Why This Is Dangerous
            </Typography>
            <Typography variant="body2" color="text.secondary">{finding.risk_explanation}</Typography>
          </Box>
        )}

        {/* Recommendation */}
        {finding.recommendation && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 1, bgcolor: "background.default", borderLeft: "3px solid", borderColor: "success.main" }}>
            <Typography variant="caption" fontWeight={700} color="success.main" display="block" sx={{ mb: 0.5 }}>
              Recommendation
            </Typography>
            <Typography variant="body2" color="text.secondary">{finding.recommendation}</Typography>
          </Box>
        )}

        {/* Secure code example */}
        {finding.secure_code_example && (
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Secure Code Example
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                borderRadius: 1,
                bgcolor: isDark ? "#0d1117" : "#f6f8fa",
                fontFamily: "monospace",
                fontSize: 12,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {finding.secure_code_example}
            </Box>
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default FindingCard;
