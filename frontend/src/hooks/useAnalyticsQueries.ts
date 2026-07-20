/**
 * React Query hooks for all 6 Analytics API endpoints.
 *
 * useAnalyticsOverview     — aggregate KPIs
 * useAnalyticsRepositories — per-repo metrics table
 * useAnalyticsTrends       — daily / weekly / monthly time-series
 * useAnalyticsModels       — per-LLM-model usage
 * useAnalyticsSecurity     — security / bugs metrics
 * useAnalyticsPerformance  — execution time statistics
 *
 * All hooks accept an AnalyticsParams object so callers can drive filters
 * from a shared filter state.  The query key includes the params so React
 * Query re-fetches automatically when they change.
 */
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/api";
import type {
  AnalyticsParams,
  ModelAnalyticsList,
  OverviewMetrics,
  PerformanceAnalytics,
  RepositoryAnalyticsList,
  SecurityAnalytics,
  TrendAnalytics,
} from "@/types";

// ── Query keys ────────────────────────────────────────────────────────────────

export const ANALYTICS_KEYS = {
  all: ["analytics"] as const,
  overview: (p: AnalyticsParams) => ["analytics", "overview", p] as const,
  repositories: (p: AnalyticsParams) => ["analytics", "repositories", p] as const,
  trends: (p: AnalyticsParams) => ["analytics", "trends", p] as const,
  models: (p: AnalyticsParams) => ["analytics", "models", p] as const,
  security: (p: AnalyticsParams) => ["analytics", "security", p] as const,
  performance: (p: AnalyticsParams) => ["analytics", "performance", p] as const,
} as const;

const STALE = 60_000; // 60 s — analytics are cheap to re-fetch

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAnalyticsOverview(params: AnalyticsParams = {}) {
  return useQuery<OverviewMetrics, Error>({
    queryKey: ANALYTICS_KEYS.overview(params),
    queryFn: () => analyticsApi.overview(params),
    staleTime: STALE,
  });
}

export function useAnalyticsRepositories(params: AnalyticsParams = {}) {
  return useQuery<RepositoryAnalyticsList, Error>({
    queryKey: ANALYTICS_KEYS.repositories(params),
    queryFn: () => analyticsApi.repositories(params),
    staleTime: STALE,
  });
}

export function useAnalyticsTrends(params: AnalyticsParams = {}) {
  return useQuery<TrendAnalytics, Error>({
    queryKey: ANALYTICS_KEYS.trends(params),
    queryFn: () => analyticsApi.trends(params),
    staleTime: STALE,
  });
}

export function useAnalyticsModels(params: AnalyticsParams = {}) {
  return useQuery<ModelAnalyticsList, Error>({
    queryKey: ANALYTICS_KEYS.models(params),
    queryFn: () => analyticsApi.models(params),
    staleTime: STALE,
  });
}

export function useAnalyticsSecurity(params: AnalyticsParams = {}) {
  return useQuery<SecurityAnalytics, Error>({
    queryKey: ANALYTICS_KEYS.security(params),
    queryFn: () => analyticsApi.security(params),
    staleTime: STALE,
  });
}

export function useAnalyticsPerformance(params: AnalyticsParams = {}) {
  return useQuery<PerformanceAnalytics, Error>({
    queryKey: ANALYTICS_KEYS.performance(params),
    queryFn: () => analyticsApi.performance(params),
    staleTime: STALE,
  });
}
