/**
 * ReportWizard — form for configuring and generating a new report.
 * Lets the user choose: report type, format, repository filter,
 * date range, modules to include, and an optional custom title.
 */
import React, { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import type {
  ReportFormat,
  ReportGenerateRequest,
  ReportModule,
  ReportType,
} from "@/types";
import { REPORT_FORMAT_LABELS, REPORT_TYPE_LABELS } from "@/types";

const ALL_MODULES: { value: ReportModule; label: string }[] = [
  { value: "reviews", label: "PR Reviews" },
  { value: "security", label: "Security Scans" },
  { value: "api_quality", label: "API Quality" },
  { value: "tests", label: "Test Generator" },
  { value: "analytics", label: "Analytics" },
];

interface ReportWizardProps {
  onGenerate: (req: ReportGenerateRequest) => void;
  isLoading: boolean;
}

const ReportWizard: React.FC<ReportWizardProps> = ({ onGenerate, isLoading }) => {
  const [reportType, setReportType] = useState<ReportType>("full");
  const [reportFormat, setReportFormat] = useState<ReportFormat>("markdown");
  const [reportTitle, setReportTitle] = useState("");
  const [repository, setRepository] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modules, setModules] = useState<ReportModule[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleModule = (mod: ReportModule) => {
    setModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  };

  const handleSubmit = () => {
    const req: ReportGenerateRequest = {
      report_type: reportType,
      report_format: reportFormat,
      ...(reportTitle.trim() && { report_title: reportTitle.trim() }),
      ...(repository.trim() && { repository: repository.trim() }),
      ...(dateFrom && { date_from: dateFrom }),
      ...(dateTo && { date_to: dateTo }),
      ...(modules.length > 0 && { modules }),
    };
    onGenerate(req);
  };

  return (
    <Paper sx={{ p: 3 }} elevation={0}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
        <AssessmentIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700}>
          Configure Report
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        {/* Report type */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Report Type</InputLabel>
            <Select
              value={reportType}
              label="Report Type"
              onChange={(e) => setReportType(e.target.value as ReportType)}
              disabled={isLoading}
            >
              {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Format */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Output Format</InputLabel>
            <Select
              value={reportFormat}
              label="Output Format"
              onChange={(e) => setReportFormat(e.target.value as ReportFormat)}
              disabled={isLoading}
            >
              {(Object.entries(REPORT_FORMAT_LABELS) as [ReportFormat, string][]).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Repository filter */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small"
            label="Repository (optional)"
            placeholder="owner/repo"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            disabled={isLoading}
            helperText="Filter data to a specific repository"
          />
        </Grid>

        {/* Custom title */}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small"
            label="Custom Title (optional)"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            disabled={isLoading}
          />
        </Grid>
      </Grid>

      {/* Advanced options toggle */}
      <Box sx={{ mt: 2 }}>
        <Button
          size="small"
          color="inherit"
          endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAdvanced((v) => !v)}
          sx={{ textTransform: "none", color: "text.secondary" }}
        >
          Advanced options
        </Button>
        <Collapse in={showAdvanced}>
          <Box sx={{ pt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" type="date"
                  label="Date From"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  disabled={isLoading}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth size="small" type="date"
                  label="Date To"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  disabled={isLoading}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend" sx={{ fontSize: 13, mb: 0.5 }}>
                    Modules to include (leave blank for type default)
                  </FormLabel>
                  <FormGroup row>
                    {ALL_MODULES.map(({ value, label }) => (
                      <FormControlLabel
                        key={value}
                        control={
                          <Checkbox
                            size="small"
                            checked={modules.includes(value)}
                            onChange={() => toggleModule(value)}
                            disabled={isLoading}
                          />
                        }
                        label={<Typography variant="body2">{label}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Box>

      <Box sx={{ mt: 2.5 }}>
        <Button
          variant="contained"
          size="large"
          disabled={isLoading}
          onClick={handleSubmit}
          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <AssessmentIcon />}
          sx={{ fontWeight: 600 }}
        >
          {isLoading ? "Generating…" : "Generate Report"}
        </Button>
      </Box>
    </Paper>
  );
};

export default ReportWizard;
