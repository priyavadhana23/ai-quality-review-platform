/**
 * ReportsPage — Enterprise Report Generator feature page.
 *
 * Layout
 * ──────
 * 1. Header
 * 2. ReportWizard  — configure & generate
 * 3. ReportPreview — full report view (fresh result or history-loaded)
 * 4. ReportHistoryTable — paginated history with view / download / delete
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
import SummarizeIcon from "@mui/icons-material/Summarize";

import {
  ReportHistoryTable,
  ReportPreview,
  ReportWizard,
} from "@/components/reports";
import {
  useDeleteReport,
  useGenerateReport,
  useReport,
  useReportHistory,
} from "@/hooks/useReports";
import type {
  GeneratedReport,
  ReportGenerateRequest,
  ReportListItem,
} from "@/types";

// ── History-item viewer (fetches full report by id) ───────────────────────

interface HistoryViewerProps {
  reportId: number;
  onClose: () => void;
}

const HistoryViewer: React.FC<HistoryViewerProps> = ({ reportId, onClose }) => {
  const { data, isLoading, isError } = useReport(reportId);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data) {
    return (
      <Alert severity="error" sx={{ mb: 2 }} onClose={onClose}>
        Failed to load report.
      </Alert>
    );
  }
  return <ReportPreview report={data} onClose={onClose} />;
};

// ── Main page ─────────────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<GeneratedReport | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [histPage, setHistPage] = useState(1);
  const [histPageSize, setHistPageSize] = useState(20);

  const generateMutation = useGenerateReport();
  const deleteMutation = useDeleteReport();
  const { data: historyData, isLoading: histLoading } = useReportHistory({
    page: histPage,
    page_size: histPageSize,
  });

  const handleGenerate = useCallback(
    (req: ReportGenerateRequest) => {
      setActiveReport(null);
      setViewingId(null);
      generateMutation.mutate(req, {
        onSuccess: (report) => {
          setActiveReport(report);
          window.scrollTo({ top: 0, behavior: "smooth" });
        },
      });
    },
    [generateMutation],
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

  const handleDownloadListItem = useCallback((item: ReportListItem) => {
    const s = (item.report_title || `report-${item.id}`)
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase();
    const blob = new Blob(
      [JSON.stringify(item, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s}-summary.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <SummarizeIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Enterprise Report Generator
        </Typography>
      </Stack>

      {/* Wizard */}
      <Box sx={{ mb: 3 }}>
        <ReportWizard
          onGenerate={handleGenerate}
          isLoading={generateMutation.isPending}
        />
      </Box>

      {/* Generation error */}
      {generateMutation.isError && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => generateMutation.reset()}
        >
          {generateMutation.error?.message ?? "Report generation failed. Please try again."}
        </Alert>
      )}

      {/* Fresh result */}
      {activeReport && (
        <Box sx={{ mb: 3 }}>
          <ReportPreview report={activeReport} onClose={handleClose} />
        </Box>
      )}

      {/* History viewer */}
      {viewingId !== null && !activeReport && (
        <Box sx={{ mb: 3 }}>
          <HistoryViewer reportId={viewingId} onClose={handleClose} />
        </Box>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* History table */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
        Report History
      </Typography>
      <ReportHistoryTable
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

export default ReportsPage;
