/**
 * UploadForm — supports drag-and-drop file upload, browse, and URL paste.
 * Validates file type (YAML / JSON) and size before firing the analyze mutation.
 */
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LinkIcon from "@mui/icons-material/Link";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

const ACCEPTED = [".yaml", ".yml", ".json"];
const MAX_MB = 2;

interface UploadFormProps {
  onAnalyze: (payload: { file: File } | { specUrl: string }) => void;
  isLoading: boolean;
}

const UploadForm: React.FC<UploadFormProps> = ({ onAnalyze, isLoading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"file" | "url">("file");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) return `Unsupported file type. Use: ${ACCEPTED.join(", ")}`;
    if (file.size > MAX_MB * 1024 * 1024) return `File too large (max ${MAX_MB} MB)`;
    return null;
  };

  const handleFileSelect = (file: File) => {
    const err = validateFile(file);
    setValidationError(err);
    if (!err) setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const err = validateFile(file);
      setValidationError(err);
      if (!err) setSelectedFile(file);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = () => {
    setValidationError(null);
    if (tab === "file") {
      if (!selectedFile) { setValidationError("Please select a file."); return; }
      onAnalyze({ file: selectedFile });
    } else {
      if (!url.trim()) { setValidationError("Please enter a URL."); return; }
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        setValidationError("URL must start with http:// or https://");
        return;
      }
      onAnalyze({ specUrl: url.trim() });
    }
  };

  return (
    <Paper sx={{ p: 3 }} elevation={0}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Upload API Specification
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); setValidationError(null); setSelectedFile(null); }}
        sx={{ mb: 2 }}
      >
        <Tab value="file" label="Upload File" icon={<CloudUploadIcon fontSize="small" />} iconPosition="start" />
        <Tab value="url" label="Paste URL" icon={<LinkIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {tab === "file" ? (
        <>
          {/* Drop zone */}
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
                  Drag &amp; drop your spec file here, or <strong>click to browse</strong>
                </Typography>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                  Supported: OpenAPI / Swagger YAML or JSON · max {MAX_MB} MB
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
      ) : (
        <TextField
          fullWidth
          label="Specification URL"
          placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          helperText="Publicly accessible OpenAPI or Swagger JSON/YAML URL"
          InputProps={{ startAdornment: <LinkIcon sx={{ mr: 1, color: "text.disabled" }} fontSize="small" /> }}
        />
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
          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <AutoFixHighIcon />}
          onClick={handleSubmit}
          sx={{ bgcolor: "#238636", "&:hover": { bgcolor: "#2ea043" }, fontWeight: 600 }}
        >
          {isLoading ? "Analyzing…" : "Analyze API"}
        </Button>
        {selectedFile && (
          <Button
            size="small"
            color="inherit"
            onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
          >
            Clear
          </Button>
        )}
      </Box>

      {isLoading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }} display="block">
            AI analysis in progress — this may take 20–60 seconds…
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default UploadForm;
