/**
 * RepoTable — sortable table of per-repository analytics.
 */
import React, { useState } from "react";
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { RepositoryAnalytics } from "@/types";

dayjs.extend(relativeTime);

type SortKey = keyof Pick<
  RepositoryAnalytics,
  "review_count" | "avg_quality_score" | "avg_security_score" | "avg_review_time" | "avg_bugs_found"
>;

interface RepoTableProps {
  rows: RepositoryAnalytics[];
}

function scoreChip(val: number | null) {
  if (val == null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = val >= 70 ? "success" : val >= 40 ? "warning" : "error";
  return <Chip label={val.toFixed(0)} size="small" color={color} sx={{ fontWeight: 700, minWidth: 44 }} />;
}

const RepoTable: React.FC<RepoTableProps> = ({ rows }) => {
  const [sortKey, setSortKey] = useState<SortKey>("review_count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  if (sorted.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.disabled">No repository data yet.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Repository</TableCell>
            {(
              [
                ["review_count", "Reviews"],
                ["avg_quality_score", "Quality"],
                ["avg_security_score", "Security"],
                ["avg_review_time", "Avg Time"],
                ["avg_bugs_found", "Avg Bugs"],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <TableCell key={key} align="center" sx={{ fontWeight: 700 }}>
                <TableSortLabel
                  active={sortKey === key}
                  direction={sortKey === key ? sortDir : "desc"}
                  onClick={() => handleSort(key)}
                >
                  {label}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell sx={{ fontWeight: 700 }}>Last Reviewed</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.repo_label} hover>
              <TableCell>
                <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                  {row.repo_label}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Chip label={row.review_count} size="small" color="primary" sx={{ fontWeight: 700 }} />
              </TableCell>
              <TableCell align="center">{scoreChip(row.avg_quality_score)}</TableCell>
              <TableCell align="center">{scoreChip(row.avg_security_score)}</TableCell>
              <TableCell align="center">
                <Typography variant="body2" color="text.secondary">
                  {row.avg_review_time.toFixed(1)}s
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Typography variant="body2" color={row.avg_bugs_found > 0 ? "error.main" : "text.secondary"}>
                  {row.avg_bugs_found.toFixed(1)}
                </Typography>
              </TableCell>
              <TableCell>
                {row.last_reviewed_date ? (
                  <Tooltip title={dayjs(row.last_reviewed_date).format("YYYY-MM-DD HH:mm")}>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(row.last_reviewed_date).fromNow()}
                    </Typography>
                  </Tooltip>
                ) : (
                  <Typography variant="caption" color="text.disabled">—</Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default RepoTable;
