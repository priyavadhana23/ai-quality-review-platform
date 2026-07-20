/**
 * React Query mutation hooks — one per PR-Agent tool.
 *
 * On success each hook invalidates the history query cache so the History
 * page automatically shows the newly-persisted review without a manual
 * refresh.  The old localStorage addEntry() calls have been removed because
 * the backend now persists every review via save_review() automatically.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AskRequest, DescribeRequest, ImproveRequest, ReviewRequest } from "@/types";
import { reviewApi } from "@/api";
import { HISTORY_KEYS } from "@/hooks/useHistoryQueries";

/** POST /api/v1/review */
export const useReviewMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ReviewRequest) => reviewApi.review(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_KEYS.all });
    },
  });
};

/** POST /api/v1/describe */
export const useDescribeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: DescribeRequest) => reviewApi.describe(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_KEYS.all });
    },
  });
};

/** POST /api/v1/improve */
export const useImproveMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ImproveRequest) => reviewApi.improve(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_KEYS.all });
    },
  });
};

/** POST /api/v1/ask */
export const useAskMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AskRequest) => reviewApi.ask(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_KEYS.all });
    },
  });
};
