/**
 * React Query hooks for the AI Test Generator API.
 *
 * useGenerateTests      — mutation: POST /api/v1/tests/generate
 * useTestHistory        — query:    GET  /api/v1/tests/history (paginated)
 * useTestDetail         — query:    GET  /api/v1/tests/{id}
 * useDeleteTest         — mutation: DELETE /api/v1/tests/{id}
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { testGeneratorApi } from "@/api";
import type {
  GeneratedTestResponse,
  PaginatedTestList,
  TestGenerateRequest,
  TestHistoryParams,
} from "@/types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const TEST_KEYS = {
  all: ["tests"] as const,
  history: (params: TestHistoryParams) => ["tests", "history", params] as const,
  detail: (id: number) => ["tests", "detail", id] as const,
} as const;

// ── Generate (mutation) ───────────────────────────────────────────────────────

/**
 * POST /api/v1/tests/generate
 *
 * On success the history cache is invalidated so the history tab
 * immediately shows the new entry.
 */
export function useGenerateTests() {
  const queryClient = useQueryClient();

  return useMutation<GeneratedTestResponse, Error, TestGenerateRequest>({
    mutationFn: (body) => testGeneratorApi.generate(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEST_KEYS.all });
    },
  });
}

// ── History (paginated query) ─────────────────────────────────────────────────

/**
 * GET /api/v1/tests/history
 *
 * Re-fetches automatically whenever params change.
 * Keeps previous data visible while loading the next page.
 */
export function useTestHistory(params: TestHistoryParams = {}) {
  return useQuery<PaginatedTestList, Error>({
    queryKey: TEST_KEYS.history(params),
    queryFn: () => testGeneratorApi.list(params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}

// ── Detail ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/tests/{id}
 *
 * Only fires when id is a valid positive number.
 */
export function useTestDetail(id: number | null) {
  return useQuery<GeneratedTestResponse, Error>({
    queryKey: TEST_KEYS.detail(id ?? 0),
    queryFn: () => testGeneratorApi.getById(id!),
    enabled: id != null && id > 0,
    staleTime: 60_000,
  });
}

// ── Delete (mutation) ─────────────────────────────────────────────────────────

/**
 * DELETE /api/v1/tests/{id}
 *
 * Invalidates all history queries on success.
 */
export function useDeleteTest() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (id) => testGeneratorApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEST_KEYS.all });
    },
  });
}
