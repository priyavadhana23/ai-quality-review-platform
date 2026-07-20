/**
 * ScanForm — accepts a GitHub PR URL or an uploaded file / ZIP archive.
 * Mirrors UploadForm from api-quality but adapted for security scanning.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import GitHubIcon from "@mui/icons-material/GitHub";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import SecurityIcon from "@mui/icons-material/Security";

const ACCEPTED = [".py", ".js", ".ts", ".java", ".go", ".cs", ".rb", ".php", ".zip"];
const MAX_MB = 5;

type ScanPayload = { prUrl: string } | { file: File };

interface ScanFormProps {
  onScan: (payload: ScanPayload) => void;
  isLoading: boolean;
}

const ScanForm: React.FC<ScanFormProps> = ({ onScan, isLoading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"pr" | "file">("pr");
  const [prUrl, setPrUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ACCEPTED.includes(ext)) {
      return `Unsupported type. Accepted: ${ACCEPTED.join(", ")}`;
    }
    if (file.size > MAX_MB * 1024 * 1024) return `File too large (max ${MAX_MB} MB)`;
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const err = ("." + (file.name.split(".").pop()?.toLowerCase() ?? "")) in
      Object.fromEntries(ACCEPTED.map((e) => [e, true]))
      ? null
      : `Unsupported type. Accepted: ${ACCEPTED.join(", ")}`;
    const sizeErr = file.size > MAX_MB * 1024 * 1024 ? `File too large (max ${MAX_MB} MB)` : null;
    const finalErr = err ?? sizeErr;
    setValidationError(finalErr);
    if (!finalErr) setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const err = validateFile(file);
      setValidationError(err);
      if (!err) setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    setValidationError(null);
    if (tab === "pr") {
      const trimmed = prUrl.trim();
      if (!trimmed) { setValidationError("Please enter a PR URL."); return; }
      if (!trimmed.includes("github.com") || !trimmed.includes("/pull/")) {
        setValidationError("Must be a valid GitHub pull-request URL.");
        return;
      }
      onScan({ prUrl: trimmed });
    } else {
      if (!selectedFile) { setValidationError("Please select a file."); return; }
      onScan({ file: selectedFile });
    }
  };

  return (
    <Paper sx={{ p: 3 }} elevation={0}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Select Scan Target
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); setValidationError(null); setSelectedFile(null); }}
        sx={{ mb: 2 }}
      >
        <Tab value="pr" label="GitHub PR" icon={<GitHubIcon fontSize="small" />} iconPosition="start" />
        <Tab value="file" label="Upload File / ZIP" icon={<CloudUploadIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {tab === "pr" ? (
        <TextField
          fullWidth
          label="Pull Request URL"
          placeholder="https://github.com/owner/repo/pull/123"
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          disabled={isLoading}
          helperText="Scans all code changes in the pull request diff"
          InputProps={{ startAdornment: <GitHubIcon sx={{ mr: 1, color: "text.disabled" }} fontSize="small" /> }}
        />
      ) : (
        <>
          <Box
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${dragOver ? theme.palette.primary.main : theme.palette.divider}`,
              borderRadius: 2,
              p: 4,
              textAlign: "center",
              cursor: isLoading ? "not-allowed" : "pointer",
              bgcolor: dragOver
                ? isDark ? "#21262d" : "#f0f9ff"
                : isDark ? "#0d1117" : "#f9fafb",
              transition: "all 0.15s",
              "&:hover": { borderColor: "primary.main", bgcolor: isDark ? "#21262d" : "#f0f9ff" },
            }}
          >
            {selectedFile ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                <InsertDriveFileIcon color="primary" />
                <Box>
                  <Typography variant="body2" fontWeight={600}>{selectedFile.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </Typography>
                </Box>
              </Box>
            ) : (
              <>
                <CloudUploadIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Drag &amp; drop a source file or ZIP, or <strong>click to browse</strong>
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                  Supported: {ACCEPTED.join(", ")} · max {MAX_MB} MB
                </Typography>
              </>
            )}
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            style={{ display: "none" }}
            onChange={handleInputChange}
          />
        </>
      )}

      {validationError && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setValidationError(null)}>
          {validationError}
        </Alert>
      )}

      <Box sx={{ mt: 2.5, display: "flex", gap: 2, alignItems: "center" }}>
        <Button
          variant="contained"
          size="large"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <SecurityIcon />}
          onClick={handleSubmit}
          color="error"
          sx={{ fontWeight: 600 }}
        >
          {isLoading ? "Scanning…" : "Run Security Scan"}
        </Button>
        {selectedFile && (
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          >
            Clear
          </Button>
        )}
      </Box>

      {isLoading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress color="error" />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            AI security analysis in progress — this may take 20–60 seconds…
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ScanForm;
