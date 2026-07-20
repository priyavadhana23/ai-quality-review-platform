/**
 * React Query hooks for the Review History API.
 *
 * useHistoryQuery      — paginated list with filters/search/sort
 * useReviewDetail      — single full review (markdown + metrics)
 * useDeleteReview      — mutation that removes a review and invalidates the list
 * useRepositories      — repo list for filter drop-downs (cached 5 min)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { historyApi } from "@/api";
import type { HistoryListParams, PaginatedReviewList, ReviewDetail, RepositoryItem } from "@/types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const HISTORY_KEYS = {
  all: ["history"] as const,
  list: (params: HistoryListParams) => ["history", "list", params] as const,
  detail: (id: number) => ["history", "detail", id] as const,
  repositories: ["history", "repositories"] as const,
} as const;

// ── List (paginated + filtered) ───────────────────────────────────────────────

/**
 * Fetch the paginated history list.
 * Re-fetches automatically whenever `params` change (page, filters, search, sort).
 */
export function useHistoryQuery(params: HistoryListParams = {}) {
  return useQuery<PaginatedReviewList, Error>({
    queryKey: HISTORY_KEYS.list(params),
    queryFn: () => historyApi.list(params),
    // Keep previous data visible while the next page loads.
    placeholderData: (prev) => prev,
    staleTime: 30_000, // 30 s — history doesn't change that fast
  });
}

// ── Single review detail ──────────────────────────────────────────────────────

/**
 * Fetch a single review by ID including full markdown and metrics.
 * Only fires when `id` is a valid positive number.
 */
export function useReviewDetail(id: number | null) {
  return useQuery<ReviewDetail, Error>({
    queryKey: HISTORY_KEYS.detail(id ?? 0),
    queryFn: () => historyApi.getById(id!),
    enabled: id != null && id > 0,
    staleTime: 60_000, // detail changes rarely
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a review by ID.
 * On success, invalidates all history list queries so the UI refreshes.
 */
export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (id: number) => historyApi.delete(id),
    onSuccess: () => {
      // Bust every cached history list page so the deleted row disappears.
      queryClient.invalidateQueries({ queryKey: HISTORY_KEYS.all });
    },
  });
}

// ── Repositories (for filter drop-down) ──────────────────────────────────────

/**
 * Fetch all repositories the user has ever analysed.
 * Long cache time — this list is used only to populate a filter drop-down.
 */
export function useRepositories() {
  return useQuery<RepositoryItem[], Error>({
    queryKey: HISTORY_KEYS.repositories,
    queryFn: () => historyApi.listRepositories(),
    staleTime: 5 * 60_000, // 5 min
  });
}
