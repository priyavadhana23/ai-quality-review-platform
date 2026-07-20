/**
 * SecurityScannerPage — AI Security Scanner feature page.
 *
 * Layout
 * ──────
 * 1. Header
 * 2. ScanForm  — PR URL or file/ZIP upload
 * 3. ScanResultPanel — score cards, findings, charts, checklist, downloads
 * 4. ScanHistoryTable — paginated history with view / delete / download
 */
import React, { useCallback, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import {
  ScanForm,
  ScanHistoryTable,
  ScanResultPanel,
} from "@/components/security-scanner";
import {
  useDeleteSecurityScan,
  useSecurityHistory,
  useSecurityReport,
  useSecurityScan,
} from "@/hooks/useSecurityScanner";
import type { SecurityScanListItem, SecurityScanReport } from "@/types";

dayjs.extend(relativeTime);

type ScanPayload = { prUrl: string } | { file: File };

// ── History viewer (loads full report by id) ──────────────────────────────────

interface HistoryViewerProps {
  reportId: number;
  onClose: () => void;
}

const HistoryViewer: React.FC<HistoryViewerProps> = ({ reportId, onClose }) => {
  const { data, isLoading, isError } = useSecurityReport(reportId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress color="error" />
      </Box>
    );
  }
  if (isError || !data) {
    return (
      <Alert severity="error" sx={{ mb: 2 }} onClose={onClose}>
        Failed to load scan report.
      </Alert>
    );
  }
  return <ScanResultPanel report={data} onClose={onClose} />;
};

// ── Main page ─────────────────────────────────────────────────────────────────

const SecurityScannerPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<SecurityScanReport | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(20);

  const scanMutation = useSecurityScan();
  const deleteMutation = useDeleteSecurityScan();
  const { data: historyData, isLoading: histLoading } = useSecurityHistory({
    page: histPage,
    page_size: histPageSize,
  });

  const handleScan = useCallback(
    (payload: ScanPayload) => {
      setActiveReport(null);
      setViewingId(null);
      scanMutation.mutate(payload, {
        onSuccess: (report) => {
          setActiveReport(report);
          setViewingId(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });
    },
    [scanMutation],
  );

  const handleView = useCallback((id: number) => {
    setActiveReport(null);
    setViewingId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleClose = useCallback(() => {
    setActiveReport(null);
    setViewingId(null);
  }, []);

  const handleDelete = useCallback(
    (id: number) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          if (viewingId === id) handleClose();
        },
      });
    },
    [deleteMutation, viewingId, handleClose],
  );

  const handleDownloadListItem = useCallback((item: SecurityScanListItem) => {
    const slug = (item.repository ?? "scan").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-summary.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Box>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <SecurityIcon color="error" />
        <Typography variant="h5" fontWeight={700}>
          AI Security Scanner
        </Typography>
      </Stack>

      {/* ── Scan form ────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <ScanForm onScan={handleScan} isLoading={scanMutation.isPending} />
      </Box>

      {/* ── Mutation error ────────────────────────────────────────────────── */}
      {scanMutation.isError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => scanMutation.reset()}>
          {scanMutation.error?.message ?? "Scan failed. Please try again."}
        </Alert>
      )}

      {/* ── Fresh scan result ─────────────────────────────────────────────── */}
      {activeReport && (
        <Box sx={{ mb: 3 }}>
          <ScanResultPanel report={activeReport} onClose={handleClose} />
        </Box>
      )}

      {/* ── History viewer ───────────────────────────────────────────────── */}
      {viewingId !== null && !activeReport && (
        <Box sx={{ mb: 3 }}>
          <HistoryViewer reportId={viewingId} onClose={handleClose} />
        </Box>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* ── Scan history ─────────────────────────────────────────────────── */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
        Scan History
      </Typography>
      <ScanHistoryTable
        data={historyData}
        isLoading={histLoading}
        page={histPage}
        pageSize={histPageSize}
        onPageChange={setHistPage}
        onPageSizeChange={(s) => { setHistPageSize(s); setHistPage(1); }}
        onView={handleView}
        onDelete={handleDelete}
        onDownload={handleDownloadListItem}
      />
    </Box>
  );
};

export default SecurityScannerPage;
