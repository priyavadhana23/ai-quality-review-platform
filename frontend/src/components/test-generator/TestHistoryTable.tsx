/**
 * TestHistoryTable — paginated table of past test generations.
 *
 * Each row shows: PR, language, framework, test type, coverage, confidence,
 * risk level, execution time, created date, and action buttons (Open / Delete).
 */
import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Pagination,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useDeleteTest, useTestHistory } from "@/hooks";
import type { GeneratedTestListItem } from "@/types";

dayjs.extend(relativeTime);

const RISK_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  low: "success",
  medium: "warning",
  high: "error",
};

const LANG_COLOR: Record<string, "primary" | "success" | "warning" | "info" | "default"> = {
  python: "primary",
  java: "warning",
  javascript: "success",
  typescript: "info",
  go: "default",
  csharp: "default",
};

interface TestHistoryTableProps {
  onOpen: (item: GeneratedTestListItem) => void;
  language?: string;
  framework?: string;
}

const TestHistoryTable: React.FC<TestHistoryTableProps> = ({ onOpen, language, framework }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<GeneratedTestListItem | null>(null);

  const { data, isLoading } = useTestHistory({
    page,
    page_size: 15,
    ...(language ? { language } : {}),
    ...(framework ? { framework } : {}),
  });

  const deleteMutation = useDeleteTest();

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      enqueueSnackbar("Test record deleted", { variant: "success", autoHideDuration: 2500 });
    } catch {
      enqueueSnackbar("Failed to delete", { variant: "error" });
    } finally {
      setPendingDelete(null);
    }
  };

  if (isLoading) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 1 }} />;
  }

  if (!data?.items.length) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.disabled">
          No test generations yet. Use the form above to generate your first tests.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>PR</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Language</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Framework</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Coverage</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Risk</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((item) => (
              <TableRow
                key={item.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => onOpen(item)}
              >
                <TableCell>
                  <Typography
                    variant="caption"
                    fontFamily="monospace"
                    color="primary.main"
                    noWrap
                    sx={{ maxWidth: 180, display: "block" }}
                  >
                    {item.pr_url.replace("https://github.com/", "")}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={item.language}
                    size="small"
                    color={LANG_COLOR[item.language] ?? "default"}
                    sx={{ fontWeight: 700, fontSize: 10 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {item.framework}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {item.test_type.replace("_", " ")}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {item.coverage_score != null ? (
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={item.coverage_score >= 70 ? "success.main" : item.coverage_score >= 40 ? "warning.main" : "error.main"}
                    >
                      {item.coverage_score.toFixed(0)}%
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  {item.risk_level ? (
                    <Chip
                      label={item.risk_level}
                      size="small"
                      color={RISK_COLOR[item.risk_level] ?? "default"}
                      sx={{ fontSize: 10, fontWeight: 700 }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {item.execution_time.toFixed(1)}s
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={dayjs(item.created_at).format("YYYY-MM-DD HH:mm:ss")}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {dayjs(item.created_at).fromNow()}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="Open">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpen(item); }}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(item); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {data.total_pages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination
            count={data.total_pages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
            shape="rounded"
          />
        </Box>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this test record?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the <strong>{pendingDelete?.language}</strong>/
            <strong>{pendingDelete?.framework}</strong> tests generated for{" "}
            <strong>{pendingDelete?.pr_url.replace("https://github.com/", "")}</strong>.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TestHistoryTable;
