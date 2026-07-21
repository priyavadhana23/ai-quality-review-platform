/**
 * All API calls.  Every function maps 1-to-1 to a backend route.
 * No business logic lives here — just HTTP calls and type casting.
 */
import type {
  AskData,
  AskRequest,
  DescribeData,
  DescribeRequest,
  HealthResponse,
  HistoryListParams,
  ImproveData,
  ImproveRequest,
  PaginatedReviewList,
  PullRequestItem,
  RepositoryItem,
  ReviewData,
  ReviewDetail,
  ReviewRequest,
  SuccessResponse,
  TokenResponse,
  User,
} from "@/types";
import { apiClient } from "./client";

export const healthApi = {
  check: (): Promise<HealthResponse> =>
    apiClient.get<HealthResponse>("/health").then((r) => r.data),
};

export const reviewApi = {
  review: (body: ReviewRequest): Promise<SuccessResponse<ReviewData>> =>
    apiClient.post<SuccessResponse<ReviewData>>("/api/v1/review", body).then((r) => r.data),

  describe: (body: DescribeRequest): Promise<SuccessResponse<DescribeData>> =>
    apiClient.post<SuccessResponse<DescribeData>>("/api/v1/describe", body).then((r) => r.data),

  improve: (body: ImproveRequest): Promise<SuccessResponse<ImproveData>> =>
    apiClient.post<SuccessResponse<ImproveData>>("/api/v1/improve", body).then((r) => r.data),

  ask: (body: AskRequest): Promise<SuccessResponse<AskData>> =>
    apiClient.post<SuccessResponse<AskData>>("/api/v1/ask", body).then((r) => r.data),
};

export const authApi = {
  /** Redirect the browser to GitHub OAuth (full-page navigation). */
  initiateLogin: (): void => {
    window.location.href = "/auth/login";
  },

  /** Exchange a refresh token for a new access token. */
  refresh: (refresh_token: string): Promise<TokenResponse> =>
    apiClient.post<TokenResponse>("/auth/refresh", { refresh_token }).then((r) => r.data),

  /** Revoke a refresh token (logout). */
  logout: (refresh_token: string): Promise<void> =>
    apiClient.post("/auth/logout", { refresh_token }).then(() => undefined),

  /** Get the current authenticated user's profile. */
  me: (): Promise<User> => apiClient.get<User>("/users/me").then((r) => r.data),
};

export const historyApi = {
  /** GET /api/v1/history — paginated list with optional filters. */
  list: (params: HistoryListParams = {}): Promise<PaginatedReviewList> =>
    apiClient.get<PaginatedReviewList>("/api/v1/history", { params }).then((r) => r.data),

  /** GET /api/v1/history/{id} — full detail including markdown. */
  getById: (id: number): Promise<ReviewDetail> =>
    apiClient.get<ReviewDetail>(`/api/v1/history/${id}`).then((r) => r.data),

  /** DELETE /api/v1/history/{id} — 204 on success. */
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/history/${id}`).then(() => undefined),

  /** GET /api/v1/repositories — list repos the user has analysed. */
  listRepositories: (): Promise<RepositoryItem[]> =>
    apiClient.get<RepositoryItem[]>("/api/v1/repositories").then((r) => r.data),

  /** GET /api/v1/pullrequests — list pull requests for the user. */
  listPullRequests: (): Promise<PullRequestItem[]> =>
    apiClient.get<PullRequestItem[]>("/api/v1/pullrequests").then((r) => r.data),
};

export const analyticsApi = {
  /** GET /api/v1/analytics/overview */
  overview: (params: import("@/types").AnalyticsParams = {}): Promise<import("@/types").OverviewMetrics> =>
    apiClient.get("/api/v1/analytics/overview", { params }).then((r) => r.data),

  /** GET /api/v1/analytics/repositories */
  repositories: (params: import("@/types").AnalyticsParams = {}): Promise<import("@/types").RepositoryAnalyticsList> =>
    apiClient.get("/api/v1/analytics/repositories", { params }).then((r) => r.data),

  /** GET /api/v1/analytics/trends */
  trends: (params: import("@/types").AnalyticsParams = {}): Promise<import("@/types").TrendAnalytics> =>
    apiClient.get("/api/v1/analytics/trends", { params }).then((r) => r.data),

  /** GET /api/v1/analytics/models */
  models: (params: import("@/types").AnalyticsParams = {}): Promise<import("@/types").ModelAnalyticsList> =>
    apiClient.get("/api/v1/analytics/models", { params }).then((r) => r.data),

  /** GET /api/v1/analytics/security */
  security: (params: import("@/types").AnalyticsParams = {}): Promise<import("@/types").SecurityAnalytics> =>
    apiClient.get("/api/v1/analytics/security", { params }).then((r) => r.data),

  /** GET /api/v1/analytics/performance */
  performance: (params: import("@/types").AnalyticsParams = {}): Promise<import("@/types").PerformanceAnalytics> =>
    apiClient.get("/api/v1/analytics/performance", { params }).then((r) => r.data),
};

export const testGeneratorApi = {
  /** POST /api/v1/tests/generate — generate tests and persist. */
  generate: (
    body: import("@/types").TestGenerateRequest,
  ): Promise<import("@/types").GeneratedTestResponse> =>
    apiClient.post("/api/v1/tests/generate", body).then((r) => r.data),

  /** GET /api/v1/tests/history — paginated history. */
  list: (
    params: import("@/types").TestHistoryParams = {},
  ): Promise<import("@/types").PaginatedTestList> =>
    apiClient.get("/api/v1/tests/history", { params }).then((r) => r.data),

  /** GET /api/v1/tests/{id} — full detail with code. */
  getById: (id: number): Promise<import("@/types").GeneratedTestResponse> =>
    apiClient.get(`/api/v1/tests/${id}`).then((r) => r.data),

  /** DELETE /api/v1/tests/{id} — 204 on success. */
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/tests/${id}`).then(() => undefined),
};

export const apiQualityApi = {
  /**
   * POST /api/v1/api-quality/analyze
   * Accepts a file upload OR a spec_url string.
   * Uses FormData so multipart/form-data is sent correctly.
   */
  analyze: (
    payload: { file: File } | { specUrl: string },
  ): Promise<import("@/types").ApiQualityReport> => {
    const form = new FormData();
    if ("file" in payload) {
      form.append("file", payload.file);
    } else {
      form.append("spec_url", payload.specUrl);
    }
    return apiClient
      .post("/api/v1/api-quality/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  /** GET /api/v1/api-quality/history */
  list: (
    params: import("@/types").ReportHistoryParams = {},
  ): Promise<import("@/types").PaginatedReportList> =>
    apiClient.get("/api/v1/api-quality/history", { params }).then((r) => r.data),

  /** GET /api/v1/api-quality/{id} */
  getById: (id: number): Promise<import("@/types").ApiQualityReport> =>
    apiClient.get(`/api/v1/api-quality/${id}`).then((r) => r.data),

  /** DELETE /api/v1/api-quality/{id} */
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/api-quality/${id}`).then(() => undefined),
};

export const securityApi = {
  /**
   * POST /api/v1/security/analyze
   * Accepts either a PR URL (form field) or an uploaded file/ZIP.
   */
  analyze: (
    payload: { prUrl: string } | { file: File },
  ): Promise<import("@/types").SecurityScanReport> => {
    const form = new FormData();
    if ("prUrl" in payload) {
      form.append("pr_url", payload.prUrl);
    } else {
      form.append("file", payload.file);
    }
    return apiClient
      .post("/api/v1/security/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  /** GET /api/v1/security/history */
  list: (
    params: import("@/types").ScanHistoryParams = {},
  ): Promise<import("@/types").PaginatedScanList> =>
    apiClient.get("/api/v1/security/history", { params }).then((r) => r.data),

  /** GET /api/v1/security/{id} */
  getById: (id: number): Promise<import("@/types").SecurityScanReport> =>
    apiClient.get(`/api/v1/security/${id}`).then((r) => r.data),

  /** DELETE /api/v1/security/{id} */
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/security/${id}`).then(() => undefined),
};

export const reportsApi = {
  /** POST /api/v1/reports/generate */
  generate: (
    req: import("@/types").ReportGenerateRequest,
  ): Promise<import("@/types").GeneratedReport> =>
    apiClient.post("/api/v1/reports/generate", req).then((r) => r.data),

  /** GET /api/v1/reports/history */
  list: (
    params: import("@/types").ReportHistoryParams = {},
  ): Promise<import("@/types").GeneratedReportList> =>
    apiClient.get("/api/v1/reports/history", { params }).then((r) => r.data),

  /** GET /api/v1/reports/{id} */
  getById: (id: number): Promise<import("@/types").GeneratedReport> =>
    apiClient.get(`/api/v1/reports/${id}`).then((r) => r.data),

  /** DELETE /api/v1/reports/{id} */
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/reports/${id}`).then(() => undefined),
};

export const workspaceApi = {
  // ── Organizations ──────────────────────────────────────────────────────
  createOrg: (req: import("@/types").OrgCreate): Promise<import("@/types").OrgResponse> =>
    apiClient.post("/api/v1/organizations", req).then((r) => r.data),

  listOrgs: (): Promise<import("@/types").OrgResponse[]> =>
    apiClient.get("/api/v1/organizations").then((r) => r.data),

  // ── Workspaces ─────────────────────────────────────────────────────────
  create: (req: import("@/types").WorkspaceCreate): Promise<import("@/types").WorkspaceResponse> =>
    apiClient.post("/api/v1/workspaces", req).then((r) => r.data),

  list: (): Promise<import("@/types").WorkspaceListResponse> =>
    apiClient.get("/api/v1/workspaces").then((r) => r.data),

  get: (id: number): Promise<import("@/types").WorkspaceResponse> =>
    apiClient.get(`/api/v1/workspaces/${id}`).then((r) => r.data),

  update: (id: number, req: import("@/types").WorkspaceUpdate): Promise<import("@/types").WorkspaceResponse> =>
    apiClient.put(`/api/v1/workspaces/${id}`, req).then((r) => r.data),

  delete: (id: number): Promise<void> =>
    apiClient.delete(`/api/v1/workspaces/${id}`).then(() => undefined),

  dashboard: (id: number): Promise<import("@/types").WorkspaceDashboard> =>
    apiClient.get(`/api/v1/workspaces/${id}/dashboard`).then((r) => r.data),

  // ── Members ────────────────────────────────────────────────────────────
  listMembers: (id: number): Promise<import("@/types").WorkspaceMember[]> =>
    apiClient.get(`/api/v1/workspaces/${id}/members`).then((r) => r.data),

  updateRole: (id: number, userId: number, req: import("@/types").RoleUpdate): Promise<import("@/types").WorkspaceMember> =>
    apiClient.put(`/api/v1/workspaces/${id}/members/${userId}/role`, req).then((r) => r.data),

  removeMember: (id: number, userId: number): Promise<void> =>
    apiClient.delete(`/api/v1/workspaces/${id}/members/${userId}`).then(() => undefined),

  transferOwnership: (id: number, newOwnerId: number): Promise<import("@/types").WorkspaceResponse> =>
    apiClient.post(`/api/v1/workspaces/${id}/transfer/${newOwnerId}`).then((r) => r.data),

  // ── Invites ────────────────────────────────────────────────────────────
  createInvite: (id: number, req: import("@/types").InviteCreate): Promise<import("@/types").WorkspaceInvite> =>
    apiClient.post(`/api/v1/workspaces/${id}/invites`, req).then((r) => r.data),

  listInvites: (id: number): Promise<import("@/types").WorkspaceInvite[]> =>
    apiClient.get(`/api/v1/workspaces/${id}/invites`).then((r) => r.data),

  revokeInvite: (id: number, inviteId: number): Promise<void> =>
    apiClient.delete(`/api/v1/workspaces/${id}/invites/${inviteId}`).then(() => undefined),

  acceptInvite: (token: string): Promise<import("@/types").WorkspaceResponse> =>
    apiClient.post("/api/v1/workspaces/invites/accept", null, { params: { token } }).then((r) => r.data),

  // ── Repositories ───────────────────────────────────────────────────────
  attachRepo: (id: number, req: import("@/types").RepoAttach): Promise<import("@/types").WorkspaceRepo> =>
    apiClient.post(`/api/v1/workspaces/${id}/repos`, req).then((r) => r.data),

  listRepos: (id: number): Promise<import("@/types").WorkspaceRepo[]> =>
    apiClient.get(`/api/v1/workspaces/${id}/repos`).then((r) => r.data),

  detachRepo: (id: number, repoId: number): Promise<void> =>
    apiClient.delete(`/api/v1/workspaces/${id}/repos/${repoId}`).then(() => undefined),

  // ── Activity ───────────────────────────────────────────────────────────
  getActivity: (id: number, page = 1, pageSize = 20): Promise<import("@/types").ActivityLogList> =>
    apiClient.get(`/api/v1/workspaces/${id}/activity`, { params: { page, page_size: pageSize } }).then((r) => r.data),

  // ── Notifications ──────────────────────────────────────────────────────
  getNotifications: (unreadOnly = false): Promise<import("@/types").NotificationList> =>
    apiClient.get("/api/v1/notifications", { params: { unread_only: unreadOnly } }).then((r) => r.data),

  markRead: (notificationId: number): Promise<void> =>
    apiClient.post(`/api/v1/notifications/${notificationId}/read`).then(() => undefined),

  markAllRead: (): Promise<void> =>
    apiClient.post("/api/v1/notifications/read-all").then(() => undefined),
};
