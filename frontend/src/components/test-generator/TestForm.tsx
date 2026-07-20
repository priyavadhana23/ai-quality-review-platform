/**
 * TestForm — the input panel for the AI Test Generator.
 *
 * Renders PR URL, language, framework, and test-type selectors.
 * Framework options are filtered dynamically based on the selected language.
 */
import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import type {
  TestFramework,
  TestLanguage,
  TestType,
  TestGenerateRequest,
} from "@/types";
import {
  FRAMEWORK_OPTIONS,
  LANGUAGE_OPTIONS,
  TEST_TYPE_OPTIONS,
} from "@/types";

interface TestFormProps {
  onSubmit: (req: TestGenerateRequest) => void;
  isLoading: boolean;
}

const TestForm: React.FC<TestFormProps> = ({ onSubmit, isLoading }) => {
  const [prUrl, setPrUrl] = React.useState("");
  const [language, setLanguage] = React.useState<TestLanguage>("python");
  const [framework, setFramework] = React.useState<TestFramework>("pytest");
  const [testType, setTestType] = React.useState<TestType>("unit");
  const [urlError, setUrlError] = React.useState("");

  // Keep framework in sync when language changes
  const compatibleFrameworks = FRAMEWORK_OPTIONS.filter((f) =>
    f.languages.includes(language),
  );

  React.useEffect(() => {
    const isCompat = compatibleFrameworks.some((f) => f.value === framework);
    if (!isCompat && compatibleFrameworks.length > 0) {
      setFramework(compatibleFrameworks[0].value);
    }
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prUrl.includes("github.com") || !prUrl.includes("/pull/")) {
      setUrlError("Must be a valid GitHub pull-request URL");
      return;
    }
    setUrlError("");
    onSubmit({ pr_url: prUrl.trim(), language, framework, test_type: testType });
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Grid container spacing={2}>
        {/* PR URL */}
        <Grid item xs={12}>
          <TextField
            label="GitHub Pull Request URL"
            placeholder="https://github.com/owner/repo/pull/123"
            value={prUrl}
            onChange={(e) => {
              setPrUrl(e.target.value);
              if (urlError) setUrlError("");
            }}
            error={!!urlError}
            helperText={urlError || "Paste the full PR URL to generate tests for its diff"}
            fullWidth
            size="small"
            required
            disabled={isLoading}
          />
        </Grid>

        {/* Language */}
        <Grid item xs={12} sm={4}>
          <FormControl size="small" fullWidth>
            <InputLabel>Language</InputLabel>
            <Select
              value={language}
              label="Language"
              onChange={(e) => setLanguage(e.target.value as TestLanguage)}
              disabled={isLoading}
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <MenuItem key={l.value} value={l.value}>
                  {l.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Framework */}
        <Grid item xs={12} sm={4}>
          <FormControl size="small" fullWidth>
            <InputLabel>Framework</InputLabel>
            <Select
              value={framework}
              label="Framework"
              onChange={(e) => setFramework(e.target.value as TestFramework)}
              disabled={isLoading}
            >
              {compatibleFrameworks.map((f) => (
                <MenuItem key={f.value} value={f.value}>
                  {f.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Filtered to {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label}</FormHelperText>
          </FormControl>
        </Grid>

        {/* Test type */}
        <Grid item xs={12} sm={4}>
          <FormControl size="small" fullWidth>
            <InputLabel>Test Type</InputLabel>
            <Select
              value={testType}
              label="Test Type"
              onChange={(e) => setTestType(e.target.value as TestType)}
              disabled={isLoading}
            >
              {TEST_TYPE_OPTIONS.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Submit */}
        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
            disabled={isLoading || !prUrl.trim()}
            sx={{ minWidth: 200 }}
          >
            {isLoading ? "Generating…" : "Generate Tests"}
          </Button>
          {isLoading && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              Analysing PR diff and generating test cases…
            </Typography>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default TestForm;
