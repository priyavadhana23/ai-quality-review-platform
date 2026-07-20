/**
 * History page — server-driven review history.
 *
 * All data comes from GET /api/v1/history.  Filtering, searching, sorting,
 * and pagination are performed server-side.  The local localStorage store is
 * no longer used here.
 */
import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useDeleteReview, useHistoryQuery, useRepositories } from "@/hooks";
import type { HistoryListParams, ReviewListItem } from "@/types";

dayjs.extend(relativeTime);

const TOOL_COLOR: Record<string, "primary" | "success" | "warning" | "info" | "default"> = {
  review: "primary",
  describe: "success",
  improve: "warning",
  ask: "info",
};

const PAGE_SIZE = 20;

// ── Download helper ───────────────────────────────────────────────────────────

function downloadMarkdown(item: ReviewListItem) {
  const filename = `review-${item.github_owner}-${item.github_repo}-PR${item.pr_number}-${item.id}.md`;
  const content = [
    `# PR Review — ${item.github_owner}/${item.github_repo} #${item.pr_number}`,
    "",
    `**Tool:** ${item.tool}  `,
    `**Model:** ${item.llm_model ?? "unknown"}  `,
    `**Execution time:** ${item.execution_time.toFixed(2)}s  `,
    `**Created:** ${dayjs(item.created_at).format("YYYY-MM-DD HH:mm")}  `,
    `**PR URL:** ${item.pr_url}`,
    "",
    "---",
    "",
    item.review_summary ?? "(no summary available — open the review for full content)",
  ].join("\n");

  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

const History: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  // ── Filter / pagination state ───────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState(""); // debounced via submit
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [repoFilter, setRepoFilter] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  // ── Confirm-delete dialog ───────────────────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState<ReviewListItem | null>(null);

  const params: HistoryListParams = {
    page,
    page_size: PAGE_SIZE,
    sort,
    ...(toolFilter && toolFilter !== "all" ? { tool: toolFilter } : {}),
    ...(repoFilter ? { repo: repoFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, isError, error } = useHistoryQuery(params);
  const { data: repos } = useRepositories();
  const deleteMutation = useDeleteReview();

  // Reset to page 1 whenever a filter changes.
  const applyFilter = useCallback((fn: () => void) => {
    fn();
    setPage(1);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilter(() => setSearch(searchInput));
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      enqueueSnackbar("Review deleted", { variant: "success", autoHideDuration: 2500 });
    } catch {
      enqueueSnackbar("Failed to delete review", { variant: "error" });
    } finally {
      setPendingDelete(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 1 }}>
        <HistoryIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Review History
        </Typography>
        {data && (
          <Chip label={data.total} size="small" color="primary" sx={{ ml: 1 }} />
        )}
      </Box>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 3 }}
        alignItems={{ sm: "center" }}
      >
        {/* Search */}
        <Box component="form" onSubmit={handleSearchSubmit} sx={{ flexGrow: 1, display: "flex", gap: 1 }}>
          <TextField
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search PR URL or content…"
            size="small"
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Button type="submit" variant="outlined" size="small">
            Search
          </Button>
          {search && (
            <Button
              size="small"
              onClick={() => {
                setSearchInput("");
                applyFilter(() => setSearch(""));
              }}
            >
              Clear
            </Button>
          )}
        </Box>

        {/* Tool filter */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Tool</InputLabel>
          <Select
            value={toolFilter}
            label="Tool"
            onChange={(e) => applyFilter(() => setToolFilter(e.target.value))}
          >
            <MenuItem value="all">All Tools</MenuItem>
            <MenuItem value="review">Review</MenuItem>
            <MenuItem value="describe">Describe</MenuItem>
            <MenuItem value="improve">Improve</MenuItem>
            <MenuItem value="ask">Ask</MenuItem>
          </Select>
        </FormControl>

        {/* Repository filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Repository</InputLabel>
          <Select
            value={repoFilter}
            label="Repository"
            onChange={(e) => applyFilter(() => setRepoFilter(e.target.value))}
          >
            <MenuItem value="">All Repos</MenuItem>
            {(repos ?? []).map((r) => (
              <MenuItem key={r.id} value={`${r.github_owner}/${r.github_repo}`}>
                {r.github_owner}/{r.github_repo}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sort */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Sort</InputLabel>
          <Select
            value={sort}
            label="Sort"
            onChange={(e) => applyFilter(() => setSort(e.target.value as "newest" | "oldest"))}
          >
            <MenuItem value="newest">Newest First</MenuItem>
            <MenuItem value="oldest">Oldest First</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load history: {(error as Error).message}
        </Alert>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <Alert severity="info">
          {data.total === 0 && !search && toolFilter === "all" && !repoFilter
            ? "No review history yet. Analyze a PR from the Dashboard."
            : "No results match your filters."}
        </Alert>
      )}

      {!isLoading && !isError && (data?.items.length ?? 0) > 0 && (
        <>
          <TableContainer sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Repository</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>PR</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tool</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data!.items.map((item) => (
                  <TableRow
                    key={item.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/history/${item.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" noWrap>
                        {item.github_owner}/{item.github_repo}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        #{item.pr_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.tool.toUpperCase()}
                        color={TOOL_COLOR[item.tool] ?? "default"}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: 10 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {item.llm_model ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {item.execution_time.toFixed(1)}s
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={dayjs(item.created_at).format("YYYY-MM-DD HH:mm:ss")}>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {dayjs(item.created_at).fromNow()}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Open review">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/history/${item.id}`);
                            }}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download Markdown">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadMarkdown(item);
                            }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete(item);
                            }}
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

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {data!.total_pages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={data!.total_pages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      )}

      {/* ── Confirm-delete dialog ──────────────────────────────────────── */}
      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this review?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the <strong>{pendingDelete?.tool}</strong> review for{" "}
            <strong>
              {pendingDelete?.github_owner}/{pendingDelete?.github_repo} #{pendingDelete?.pr_number}
            </strong>
            . This action cannot be undone.
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
    </Box>
  );
};

export default History;
