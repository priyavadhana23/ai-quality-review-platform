import React, { useState } from "react";
import {
  Box, Chip, IconButton, LinearProgress, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow,
  Tooltip, Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { ApiQualityListItem, PaginatedReportList } from "@/types";

dayjs.extend(relativeTime);

function scoreChip(val: number | null | undefined) {
  if (val === null || val === undefined) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = val >= 80 ? "success" : val >= 60 ? "warning" : "error";
  return <Chip label={val.toFixed(0)} size="small" color={color} variant="outlined" sx={{ fontWeight: 700, fontSize: 12 }} />;
}

interface ReportHistoryTableProps {
  data: PaginatedReportList | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onView: (id: number) => void;
  onDelete: (id: number) => void;
  onDownload: (item: ApiQualityListItem) => void;
}

const ReportHistoryTable: React.FC<ReportHistoryTableProps> = ({
  data, isLoading, page, pageSize, onPageChange, onPageSizeChange, onView, onDelete, onDownload,
}) => {
  if (isLoading) return <LinearProgress />;
  if (!data || data.items.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }} elevation={0}>
        <Typography color="text.secondary">No reports yet. Upload a spec to get started.</Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} elevation={0}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>File</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Score</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Security</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Endpoints</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{item.api_title ?? item.filename}</Typography>
                  {item.api_title && (
                    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>{item.filename}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{item.spec_version}</Typography>
                  {item.api_version && (
                    <Typography variant="caption" color="text.disabled" display="block">v{item.api_version}</Typography>
                  )}
                </TableCell>
                <TableCell align="center">{scoreChip(item.quality_score)}</TableCell>
                <TableCell align="center">{scoreChip(item.security_score)}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{item.total_endpoints}</Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={dayjs(item.created_at).format("YYYY-MM-DD HH:mm")}>
                    <Typography variant="body2">{dayjs(item.created_at).fromNow()}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
                    {item.llm_model ?? "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Report"><IconButton size="small" onClick={() => onView(item.id)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Download JSON"><IconButton size="small" onClick={() => onDownload(item)}><DownloadIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => onDelete(item.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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
