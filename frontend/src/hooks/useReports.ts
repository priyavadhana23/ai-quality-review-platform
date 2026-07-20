/**
 * React Query hooks for the Enterprise Report Generator.
 *
 * useGenerateReport    — mutation: POST /api/v1/reports/generate
 * useReportHistory     — query:    GET  /api/v1/reports/history
 * useReport            — query:    GET  /api/v1/reports/{id}
 * useDeleteReport      — mutation: DELETE /api/v1/reports/{id}
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { reportsApi } from "@/api";
import type {
  GeneratedReport,
  GeneratedReportList,
  ReportGenerateRequest,
  ReportHistoryParams,
} from "@/types";

export const REPORT_KEYS = {
  all: ["reports"] as const,
  history: (params: ReportHistoryParams) => ["reports", "history", params] as const,
  detail: (id: number) => ["reports", "detail", id] as const,
} as const;

export function useGenerateReport() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<GeneratedReport, Error, ReportGenerateRequest>({
    mutationFn: (req) => reportsApi.generate(req),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: REPORT_KEYS.all });
      queryClient.setQueryData(REPORT_KEYS.detail(data.id), data);
      enqueueSnackbar(`Report "${data.report_title}" generated successfully`, {
        variant: "success",
        autoHideDuration: 4000,
      });
    },
    onError: (err) => {
      enqueueSnackbar(`Report generation failed: ${err.message}`, {
        variant: "error",
        autoHideDuration: 6000,
      });
    },
  });
}

export function useReportHistory(params: ReportHistoryParams = {}) {
  return useQuery<GeneratedReportList, Error>({
    queryKey: REPORT_KEYS.history(params),
    queryFn: () => reportsApi.list(params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

export function useReport(id: number | null) {
  return useQuery<GeneratedReport, Error>({
    queryKey: REPORT_KEYS.detail(id!),
    queryFn: () => reportsApi.getById(id!),
    enabled: id !== null && id > 0,
    staleTime: 5 * 60_000,
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<void, Error, number>({
    mutationFn: (id) => reportsApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: REPORT_KEYS.all });
      queryClient.removeQueries({ queryKey: REPORT_KEYS.detail(id) });
      enqueueSnackbar("Report deleted", { variant: "success", autoHideDuration: 2500 });
    },
    onError: (err) => {
      enqueueSnackbar(`Delete failed: ${err.message}`, { variant: "error" });
    },
  });
}
