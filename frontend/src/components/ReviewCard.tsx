import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useSnackbar } from "notistack";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { ReviewHistoryEntry } from "@/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const TOOL_COLOR: Record<string, "primary" | "success" | "warning" | "info"> = {
  review: "primary",
  describe: "success",
  improve: "warning",
  ask: "info",
};

interface ReviewCardProps {
  entry: ReviewHistoryEntry;
  defaultExpanded?: boolean;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ entry }) => {
  const { enqueueSnackbar } = useSnackbar();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(entry.output).then(() => {
      enqueueSnackbar("Copied to clipboard", { variant: "success", autoHideDuration: 2000 });
    });
  };

  return (
    <Card sx={{ mb: 2 }} elevation={0}>
      <CardHeader
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Chip
              label={entry.tool.toUpperCase()}
              color={TOOL_COLOR[entry.tool] ?? "default"}
              size="small"
              sx={{ fontWeight: 700, fontSize: 11 }}
            />
            <Typography
              variant="body2"
              component="a"
              href={entry.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "primary.main",
                textDecoration: "none",
                fontFamily: "monospace",
                fontSize: 12,
                "&:hover": { textDecoration: "underline" },
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: { xs: 180, sm: 320, md: 480 },
                display: "block",
              }}
            >
              {entry.pr_url}
            </Typography>
          </Box>
        }
        subheader={
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: 13, color: "text.disabled" }} />
              <Typography variant="caption" color="text.disabled">
                {entry.execution_time.toFixed(1)}s
              </Typography>
            </Box>
            <Typography variant="caption" color="text.disabled">
              {dayjs(entry.timestamp).fromNow()}
            </Typography>
          </Box>
        }
        action={
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title="Open PR">
              <IconButton
                size="small"
                href={entry.pr_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy output">
              <IconButton size="small" onClick={copyToClipboard}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />
      {entry.question && (
        <>
          <Divider />
          <Box sx={{ px: 2, py: 1, bgcolor: "background.default", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Question:
            </Typography>
            <Typography variant="body2" color="text.primary" sx={{ mt: 0.25 }}>
              {entry.question}
            </Typography>
          </Box>
        </>
      )}
      <Divider />
      <CardContent>
        <MarkdownRenderer content={entry.output} />
      </CardContent>
    </Card>
  );
};
