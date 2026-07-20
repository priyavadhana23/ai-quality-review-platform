/**
 * React Query hooks for the API Quality Analyzer.
 *
 * useAnalyzeApi     — mutation: POST /api/v1/api-quality/analyze
 * useApiHistory     — query:    GET  /api/v1/api-quality/history
 * useApiReport      — query:    GET  /api/v1/api-quality/{id}
 * useDeleteApiReport— mutation: DELETE /api/v1/api-quality/{id}
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { apiQualityApi } from "@/api";
import type { ApiQualityReport, PaginatedReportList, ReportHistoryParams } from "@/types";

// ── Query keys ────────────────────────────────────────────────────────────────
export const API_QUALITY_KEYS = {
  all: ["api-quality"] as const,
  history: (params: ReportHistoryParams) => ["api-quality", "history", params] as const,
  detail: (id: number) => ["api-quality", "detail", id] as const,
};

// ── useAnalyzeApi ─────────────────────────────────────────────────────────────

type AnalyzePayload = { file: File } | { specUrl: string };

export const useAnalyzeApi = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<ApiQualityReport, Error, AnalyzePayload>({
    mutationFn: (payload) => apiQualityApi.analyze(payload),
    onSuccess: (data) => {
      // Invalidate history so the new report appears immediately.
      queryClient.invalidateQueries({ queryKey: API_QUALITY_KEYS.all });
      // Seed the detail cache so navigating to the report is instant.
      queryClient.setQueryData(API_QUALITY_KEYS.detail(data.id), data);
      enqueueSnackbar(
        `Analysis complete — overall score: ${data.quality_score?.toFixed(0) ?? "—"}`,
        { variant: "success", autoHideDuration: 4000 },
      );
    },
    onError: (err) => {
      enqueueSnackbar(`Analysis failed: ${err.message}`, {
        variant: "error",
        autoHideDuration: 6000,
      });
    },
  });
};

// ── useApiHistory ─────────────────────────────────────────────────────────────

export const useApiHistory = (params: ReportHistoryParams = {}) =>
  useQuery<PaginatedReportList, Error>({
    queryKey: API_QUALITY_KEYS.history(params),
    queryFn: () => apiQualityApi.list(params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

// ── useApiReport ──────────────────────────────────────────────────────────────

export const useApiReport = (id: number | null) =>
  useQuery<ApiQualityReport, Error>({
    queryKey: API_QUALITY_KEYS.detail(id!),
    queryFn: () => apiQualityApi.getById(id!),
    enabled: id !== null && id > 0,
    staleTime: 5 * 60_000,
  });

// ── useDeleteApiReport ────────────────────────────────────────────────────────

export const useDeleteApiReport = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<void, Error, number>({
    mutationFn: (id) => apiQualityApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: API_QUALITY_KEYS.all });
      queryClient.removeQueries({ queryKey: API_QUALITY_KEYS.detail(id) });
      enqueueSnackbar("Report deleted", { variant: "success", autoHideDuration: 2500 });
    },
    onError: (err) => {
      enqueueSnackbar(`Delete failed: ${err.message}`, { variant: "error" });
    },
  });
};
