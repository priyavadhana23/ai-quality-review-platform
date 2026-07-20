/**
 * React Query query hook for GET /health.
 * Polls every 30 s so the settings page shows live backend status.
 */
import { useQuery } from "@tanstack/react-query";
import { healthApi } from "@/api";

export const HEALTH_QUERY_KEY = ["health"] as const;

export const useHealth = (enabled = true) =>
  useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: healthApi.check,
    enabled,
    refetchInterval: 30_000,
    retry: 2,
    staleTime: 10_000,
  });
