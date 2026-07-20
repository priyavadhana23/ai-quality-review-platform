/**
 * CodeViewer — syntax-highlighted, copyable, downloadable code panel.
 *
 * Features:
 *  - Syntax highlighting via react-syntax-highlighter
 *  - Line numbers
 *  - Copy to clipboard
 *  - Download as language-native file (.py, .java, .ts, …)
 *  - Download as Markdown
 *  - Fullscreen toggle
 */
import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { useSnackbar } from "notistack";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark, atomOneLight } from "react-syntax-highlighter/dist/esm/styles/hljs";
import type { TestLanguage } from "@/types";
import { LANGUAGE_OPTIONS, LANGUAGE_TO_HIGHLIGHT } from "@/types";

interface CodeViewerProps {
  code: string;
  language: TestLanguage;
  framework: string;
  prUrl: string;
  testId: number;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language,
  framework,
  prUrl,
  testId,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { enqueueSnackbar } = useSnackbar();
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const ext = LANGUAGE_OPTIONS.find((l) => l.value === language)?.extension ?? ".txt";
  const hlLang = LANGUAGE_TO_HIGHLIGHT[language] ?? "plaintext";
  const baseFilename = `test_pr_${testId}${ext}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    enqueueSnackbar("Copied to clipboard", { variant: "success", autoHideDuration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    downloadBlob(code, baseFilename, "text/plain");
    enqueueSnackbar(`Downloaded ${baseFilename}`, { variant: "success", autoHideDuration: 2000 });
  };

  const handleDownloadMd = () => {
    const md = [
      `# Generated Tests — PR ${prUrl}`,
      "",
      `**Language:** ${language}  `,
      `**Framework:** ${framework}  `,
      "",
      "```" + hlLang,
      code,
      "```",
    ].join("\n");
    downloadBlob(md, `test_pr_${testId}.md`, "text/markdown");
    enqueueSnackbar("Downloaded Markdown", { variant: "success", autoHideDuration: 2000 });
  };

  const toolbar = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant="caption" color="text.secondary" sx={{ mr: 1, fontFamily: "monospace" }}>
        {baseFilename}
      </Typography>
      <Tooltip title={copied ? "Copied!" : "Copy code"}>
        <IconButton size="small" onClick={handleCopy}>
          {copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Tooltip title={`Download ${ext}`}>
        <IconButton size="small" onClick={handleDownloadCode}>
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Download Markdown">
        <Button size="small" variant="outlined" sx={{ fontSize: 11, py: 0.25 }} onClick={handleDownloadMd}>
          .md
        </Button>
      </Tooltip>
      <Tooltip title="Fullscreen">
        <IconButton size="small" onClick={() => setFullscreen(true)}>
          <FullscreenIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const highlighterNode = (maxHeight?: string) => (
    <SyntaxHighlighter
      language={hlLang}
      style={isDark ? atomOneDark : atomOneLight}
      showLineNumbers
      wrapLines
      customStyle={{
        margin: 0,
        borderRadius: 8,
        fontSize: 13,
        maxHeight: maxHeight ?? "500px",
        overflowY: "auto",
      }}
    >
      {code}
    </SyntaxHighlighter>
  );

  return (
    <>
      {/* Inline panel */}
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* Toolbar row */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1.5,
            py: 0.75,
            bgcolor: isDark ? "#161b22" : "#f6f8fa",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Generated Tests
          </Typography>
          {toolbar}
        </Box>
        {highlighterNode()}
      </Box>

      {/* Fullscreen dialog */}
      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        fullWidth
        maxWidth="xl"
        PaperProps={{ sx: { height: "90vh" } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography fontWeight={700}>{baseFilename}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {toolbar}
            <Tooltip title="Close">
              <IconButton size="small" onClick={() => setFullscreen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, overflow: "hidden" }}>
          {highlighterNode("100%")}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CodeViewer;
