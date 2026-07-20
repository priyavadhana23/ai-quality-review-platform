/**
 * ReportHistoryTable — paginated list of generated reports with
 * View, Download, and Delete actions.
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
import type { GeneratedReportList, ReportListItem } from "@/types";
import { REPORT_FORMAT_LABELS, REPORT_TYPE_LABELS } from "@/types";

dayjs.extend(relativeTime);

const FORMAT_COLORS: Record<string, "default" | "primary" | "secondary"> = {
  markdown: "default",
  html: "primary",
  json: "secondary",
};

interface ReportHistoryTableProps {
  data: GeneratedReportList | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onView: (id: number) => void;
  onDelete: (id: number) => void;
  onDownload: (item: ReportListItem) => void;
}

const ReportHistoryTable: React.FC<ReportHistoryTableProps> = ({
  data, isLoading, page, pageSize,
  onPageChange, onPageSizeChange, onView, onDelete, onDownload,
}) => {
  if (isLoading) return <LinearProgress />;
  if (!data || data.items.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }} elevation={0}>
        <Typography color="text.secondary">
          No reports generated yet. Use the form above to create your first report.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} elevation={0}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Format</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Repository</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Summary</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Generated</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {item.report_title || `Report #${item.id}`}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={REPORT_TYPE_LABELS[item.report_type as keyof typeof REPORT_TYPE_LABELS] ?? item.report_type}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 11 }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={REPORT_FORMAT_LABELS[item.report_format as keyof typeof REPORT_FORMAT_LABELS] ?? item.report_format}
                    size="small"
                    color={FORMAT_COLORS[item.report_format] ?? "default"}
                    sx={{ fontSize: 11 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                    {item.repository ?? "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                  >
                    {item.summary ?? "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={dayjs(item.generated_at).format("YYYY-MM-DD HH:mm")}>
                    <Typography variant="body2">{dayjs(item.generated_at).fromNow()}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View">
                    <IconButton size="small" onClick={() => onView(item.id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download">
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

export default ReportHistoryTable;
