/**
 * EndpointTable — tabular summary of all analysed endpoints.
 */
import React, { useState } from "react";
import {
  Box,
  Chip,
  InputAdornment,
  Paper,
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
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import type { EndpointSummary } from "@/types";

interface EndpointTableProps {
  endpoints: EndpointSummary[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: "#3fb950",
  POST: "#58a6ff",
  PUT: "#d29922",
  PATCH: "#a371f7",
  DELETE: "#f85149",
  HEAD: "#8b949e",
  OPTIONS: "#8b949e",
};

const Tick: React.FC<{ ok: boolean }> = ({ ok }) =>
  ok ? (
    <CheckCircleIcon sx={{ fontSize: 16, color: "success.main" }} />
  ) : (
    <CancelIcon sx={{ fontSize: 16, color: "error.main" }} />
  );

const EndpointTable: React.FC<EndpointTableProps> = ({ endpoints }) => {
  const [search, setSearch] = useState("");

  const filtered = endpoints.filter(
    (e) =>
      !search ||
      e.path.toLowerCase().includes(search.toLowerCase()) ||
      e.method.toLowerCase().includes(search.toLowerCase()),
  );

  if (endpoints.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No endpoint data available.
      </Typography>
    );
  }

  return (
    <Box>
      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter by path or method…"
        size="small"
        sx={{ mb: 2, maxWidth: 320 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 420 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Method</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Path</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 70 }}>Auth</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 80 }}>Req Schema</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 80 }}>Res Schema</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 70 }}>Docs</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Issues</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((ep, i) => (
              <TableRow key={i} hover>
                <TableCell>
                  <Chip
                    label={ep.method}
                    size="small"
                    sx={{
                      bgcolor: METHOD_COLORS[ep.method] ?? "#8b949e",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                      height: 20,
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{ep.path}</TableCell>
                <TableCell align="center"><Tick ok={ep.has_auth} /></TableCell>
                <TableCell align="center"><Tick ok={ep.has_request_schema} /></TableCell>
                <TableCell align="center"><Tick ok={ep.has_response_schema} /></TableCell>
                <TableCell align="center"><Tick ok={ep.has_description} /></TableCell>
                <TableCell>
                  {ep.issues.length > 0 ? (
                    <Tooltip title={ep.issues.join("; ")} arrow>
                      <Chip label={ep.issues.length} size="small" color="warning" sx={{ fontSize: 11, height: 20 }} />
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="success.main">✓</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block" }}>
        Showing {filtered.length} of {endpoints.length} endpoints
      </Typography>
    </Box>
  );
};

export default EndpointTable;
