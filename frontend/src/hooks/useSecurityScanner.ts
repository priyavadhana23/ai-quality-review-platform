/**
 * React Query hooks for the AI Security Scanner.
 *
 * useSecurityScan       — mutation: POST /api/v1/security/analyze
 * useSecurityHistory    — query:    GET  /api/v1/security/history
 * useSecurityReport     — query:    GET  /api/v1/security/{id}
 * useDeleteSecurityScan — mutation: DELETE /api/v1/security/{id}
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { securityApi } from "@/api";
import type {
  PaginatedScanList,
  ScanHistoryParams,
  SecurityScanReport,
} from "@/types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const SECURITY_KEYS = {
  all: ["security"] as const,
  history: (params: ScanHistoryParams) => ["security", "history", params] as const,
  detail: (id: number) => ["security", "detail", id] as const,
} as const;

// ── Analyze (mutation) ────────────────────────────────────────────────────────

type ScanPayload = { prUrl: string } | { file: File };

export function useSecurityScan() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<SecurityScanReport, Error, ScanPayload>({
    mutationFn: (payload) => securityApi.analyze(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: SECURITY_KEYS.all });
      queryClient.setQueryData(SECURITY_KEYS.detail(data.id), data);
      const score = data.overall_security_score;
      enqueueSnackbar(
        `Scan complete — security score: ${score != null ? score.toFixed(0) : "—"}`,
        { variant: "success", autoHideDuration: 4000 },
      );
    },
    onError: (err) => {
      enqueueSnackbar(`Scan failed: ${err.message}`, {
        variant: "error",
        autoHideDuration: 6000,
      });
    },
  });
}

// ── History (paginated query) ─────────────────────────────────────────────────

export function useSecurityHistory(params: ScanHistoryParams = {}) {
  return useQuery<PaginatedScanList, Error>({
    queryKey: SECURITY_KEYS.history(params),
    queryFn: () => securityApi.list(params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

// ── Detail ────────────────────────────────────────────────────────────────────

export function useSecurityReport(id: number | null) {
  return useQuery<SecurityScanReport, Error>({
    queryKey: SECURITY_KEYS.detail(id!),
    queryFn: () => securityApi.getById(id!),
    enabled: id !== null && id > 0,
    staleTime: 5 * 60_000,
  });
}

// ── Delete (mutation) ─────────────────────────────────────────────────────────

export function useDeleteSecurityScan() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<void, Error, number>({
    mutationFn: (id) => securityApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: SECURITY_KEYS.all });
      queryClient.removeQueries({ queryKey: SECURITY_KEYS.detail(id) });
      enqueueSnackbar("Scan report deleted", {
        variant: "success",
        autoHideDuration: 2500,
      });
    },
    onError: (err) => {
      enqueueSnackbar(`Delete failed: ${err.message}`, { variant: "error" });
    },
  });
}
