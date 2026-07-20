/**
 * ScanHistoryTable — paginated history of security scans.
 */
import React from "react";
import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { PaginatedScanList, SecurityScanListItem } from "@/types";

dayjs.extend(relativeTime);

const SEV_COLORS: Record<string, "error" | "warning" | "info" | "default"> = {
  critical: "error",
  high: "warning",
  medium: "info",
  low: "default",
};

function scoreChip(val: number | null | undefined) {
  if (val == null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color: "success" | "warning" | "error" = val >= 70 ? "success" : val >= 40 ? "warning" : "error";
  return (
    <Chip
      label={val.toFixed(0)}
      size="small"
      color={color}
      variant="outlined"
      sx={{ fontWeight: 700, fontSize: 12 }}
    />
  );
}

interface ScanHistoryTableProps {
  data: PaginatedScanList | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onView: (id: number) => void;
  onDelete: (id: number) => void;
  onDownload: (item: SecurityScanListItem) => void;
}

const ScanHistoryTable: React.FC<ScanHistoryTableProps> = ({
  data, isLoading, page, pageSize,
  onPageChange, onPageSizeChange, onView, onDelete, onDownload,
}) => {
  if (isLoading) return <LinearProgress />;
  if (!data || data.items.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }} elevation={0}>
        <Typography color="text.secondary">No scan history yet. Run a scan to get started.</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} elevation={0}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Target</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Score</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Critical</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>High</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Med</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Low</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    {item.repository ?? "—"}
                  </Typography>
                  {item.branch && (
                    <Typography variant="caption" color="text.disabled">
                      {item.branch}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={item.scan_type} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                </TableCell>
                <TableCell align="center">{scoreChip(item.overall_security_score)}</TableCell>
                {(["critical_count", "high_count", "medium_count", "low_count"] as const).map((key, i) => {
                  const val = item[key];
                  const sevKey = ["critical", "high", "medium", "low"][i];
                  return (
                    <TableCell key={key} align="center">
                      {val > 0 ? (
                        <Chip
                          label={val}
                          size="small"
                          color={SEV_COLORS[sevKey] ?? "default"}
                          sx={{ fontWeight: 700, fontSize: 11, minWidth: 28 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <Tooltip title={dayjs(item.created_at).format("YYYY-MM-DD HH:mm")}>
                    <Typography variant="body2">{dayjs(item.created_at).fromNow()}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Report">
                    <IconButton size="small" onClick={() => onView(item.id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download JSON">
                    <IconButton size="small" onClick={() => onDownload(item)}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onDelete(item.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={data.total}
        page={page - 1}
        rowsPerPage={pageSize}
        onPageChange={(_, p) => onPageChange(p + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        rowsPerPageOptions={[10, 20, 50]}
      />
    </Box>
  );
};

export default ScanHistoryTable;
