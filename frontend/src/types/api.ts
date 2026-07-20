/**
 * TypeScript types that mirror the FastAPI Pydantic schemas exactly.
 * Source of truth: app/schemas/common.py and app/schemas/review.py
 */

// ── API response envelopes ────────────────────────────────────────────────────

export interface SuccessResponse<T = Record<string, unknown>> {
  status: "success";
  tool: string;
  execution_time: number;
  data: T;
}

export interface ErrorResponse {
  status: "error";
  message: string;
}

export type ApiResponse<T = Record<string, unknown>> = SuccessResponse<T> | ErrorResponse;

export interface HealthResponse {
  status: "ok";
  version: string;
  engine: string;
}

// ── Tool-specific data shapes ────────────────────────────────────────────────
// The backend stores the markdown text under data.output for all tools.

export interface ReviewData {
  output: string;
}

export interface DescribeData {
  output: string;
}

export interface ImproveData {
  output: string;
}

export interface AskData {
  output: string;
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface ReviewRequest {
  pr_url: string;
}

export interface DescribeRequest {
  pr_url: string;
}

export interface ImproveRequest {
  pr_url: string;
}

export interface AskRequest {
  pr_url: string;
  question: string;
}

// ── Local app types ───────────────────────────────────────────────────────────

/** A completed analysis stored in history. */
export interface ReviewHistoryEntry {
  id: string;
  pr_url: string;
  tool: "review" | "describe" | "improve" | "ask";
  timestamp: string; // ISO-8601
  execution_time: number;
  output: string;
  question?: string; // only for "ask"
}

/** Shape of values stored in localStorage for settings. */
export interface AppSettings {
  backendUrl: string;
  themeMode: "light" | "dark";
}

// ── History API types (mirrors app/schemas/history.py) ───────────────────────

export interface ReviewMetrics {
  bugs_found: number;
  suggestions: number;
  security_score: number | null;
  quality_score: number | null;
  complexity_score: number | null;
  maintainability_score: number | null;
}

/** Compact card returned by GET /api/v1/history */
export interface ReviewListItem {
  id: number;
  tool: string;
  review_type: string;
  review_summary: string | null;
  execution_time: number;
  llm_model: string | null;
  tokens_used: number | null;
  created_at: string;
  pr_url: string;
  pr_number: number;
  pr_title: string | null;
  github_owner: string;
  github_repo: string;
  bugs_found: number | null;
  suggestions: number | null;
  security_score: number | null;
  quality_score: number | null;
}

/** Paginated wrapper returned by GET /api/v1/history */
export interface PaginatedReviewList {
  items: ReviewListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Full detail returned by GET /api/v1/history/{id} */
export interface ReviewDetail extends ReviewListItem {
  review_markdown: string;
  branch: string | null;
  author: string | null;
  metrics: ReviewMetrics | null;
}

/** Repository returned by GET /api/v1/repositories */
export interface RepositoryItem {
  id: number;
  github_owner: string;
  github_repo: string;
  created_at: string;
  pr_count: number;
}

/** Pull request returned by GET /api/v1/pullrequests */
export interface PullRequestItem {
  id: number;
  pr_number: number;
  pr_url: string;
  title: string | null;
  branch: string | null;
  author: string | null;
  status: string;
  created_at: string;
  github_owner: string;
  github_repo: string;
}

/** Query params accepted by GET /api/v1/history */
export interface HistoryListParams {
  page?: number;
  page_size?: number;
  tool?: string;
  repo?: string;
  search?: string;
  sort?: "newest" | "oldest";
}

// ── Auth types ────────────────────────────────────────────────────────────────

/** User profile returned by GET /users/me */
export interface User {
  id: number;
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  last_login: string;
}

/** POST /auth/refresh response */
export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

/** Shape of the decoded JWT payload (client-side only) */
export interface JwtPayload {
  sub: string; // user id as string
  usr: string; // username
  role: string;
  type: "access";
  iat: number;
  exp: number;
}

/** Auth context value exposed to the entire app */
export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

// ── Analytics API types (mirrors app/schemas/analytics.py) ───────────────────

export interface OverviewMetrics {
  total_reviews: number;
  repositories_analysed: number;
  pull_requests_reviewed: number;
  avg_review_time: number;
  avg_quality_score: number | null;
  avg_security_score: number | null;
  avg_maintainability_score: number | null;
  avg_complexity_score: number | null;
  avg_bugs_found: number;
  avg_suggestions: number;
  most_used_model: string | null;
  latest_review_date: string | null;
  reviews_by_tool: Record<string, number>;
}

export interface RepositoryAnalytics {
  github_owner: string;
  github_repo: string;
  repo_label: string;
  review_count: number;
  avg_quality_score: number | null;
  avg_security_score: number | null;
  avg_review_time: number;
  avg_bugs_found: number;
  avg_suggestions: number;
  last_reviewed_date: string | null;
}

export interface RepositoryAnalyticsList {
  items: RepositoryAnalytics[];
}

export interface TrendDataPoint {
  date: string;
  reviews: number;
  avg_quality: number | null;
  avg_security: number | null;
  avg_review_time: number | null;
}

export interface TrendAnalytics {
  daily: TrendDataPoint[];
  weekly: TrendDataPoint[];
  monthly: TrendDataPoint[];
}

export interface ModelAnalytics {
  model_name: string;
  review_count: number;
  avg_response_time: number;
  avg_tokens: number | null;
  pct_of_total: number;
}

export interface ModelAnalyticsList {
  items: ModelAnalytics[];
  total_reviews: number;
}

export interface SecurityBucket {
  range: string;
  count: number;
}

export interface SecurityAnalytics {
  avg_security_score: number | null;
  total_bugs_found: number;
  reviews_with_bugs: number;
  pct_reviews_with_bugs: number;
  score_distribution: SecurityBucket[];
  top_repos_by_bugs: Array<{ repo: string; bugs: number }>;
}

export interface ToolTiming {
  tool: string;
  avg_time: number;
  count: number;
}

export interface PerformanceAnalytics {
  fastest_review: number;
  slowest_review: number;
  avg_review_time: number;
  p95_review_time: number;
  total_ai_processing_time: number;
  time_by_tool: ToolTiming[];
}

/** Shared query params for all analytics endpoints */
export interface AnalyticsParams {
  repo?: string;
  tool?: string;
  model?: string;
  date_from?: string;
  date_to?: string;
}

// ── Test Generator types (mirrors app/schemas/test_generator.py) ─────────────

export type TestLanguage = "python" | "java" | "javascript" | "typescript" | "go" | "csharp";
export type TestFramework = "pytest" | "unittest" | "junit" | "jest" | "mocha" | "nunit";
export type TestType =
  | "unit"
  | "integration"
  | "api"
  | "regression"
  | "boundary"
  | "edge_cases"
  | "negative"
  | "performance";

export const LANGUAGE_OPTIONS: { value: TestLanguage; label: string; extension: string }[] = [
  { value: "python", label: "Python", extension: ".py" },
  { value: "java", label: "Java", extension: ".java" },
  { value: "javascript", label: "JavaScript", extension: ".js" },
  { value: "typescript", label: "TypeScript", extension: ".ts" },
  { value: "go", label: "Go", extension: "_test.go" },
  { value: "csharp", label: "C#", extension: ".cs" },
];

export const FRAMEWORK_OPTIONS: { value: TestFramework; label: string; languages: TestLanguage[] }[] = [
  { value: "pytest", label: "pytest", languages: ["python"] },
  { value: "unittest", label: "unittest", languages: ["python"] },
  { value: "junit", label: "JUnit", languages: ["java"] },
  { value: "jest", label: "Jest", languages: ["javascript", "typescript"] },
  { value: "mocha", label: "Mocha", languages: ["javascript", "typescript"] },
  { value: "nunit", label: "NUnit", languages: ["csharp"] },
];

export const TEST_TYPE_OPTIONS: { value: TestType; label: string }[] = [
  { value: "unit", label: "Unit Tests" },
  { value: "integration", label: "Integration Tests" },
  { value: "api", label: "API Tests" },
  { value: "regression", label: "Regression Tests" },
  { value: "boundary", label: "Boundary Tests" },
  { value: "edge_cases", label: "Edge Cases" },
  { value: "negative", label: "Negative Tests" },
  { value: "performance", label: "Performance Tests" },
];

/** Language → syntax-highlighter language string */
export const LANGUAGE_TO_HIGHLIGHT: Record<TestLanguage, string> = {
  python: "python",
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
  go: "go",
  csharp: "csharp",
};

/** POST /api/v1/tests/generate request body */
export interface TestGenerateRequest {
  pr_url: string;
  language: TestLanguage;
  framework: TestFramework;
  test_type: TestType;
}

/** Quality analysis sub-object */
export interface TestQualityAnalysis {
  coverage_score: number | null;
  confidence_score: number | null;
  risk_level: "low" | "medium" | "high" | null;
  missing_scenarios: string[];
}

/** Full generated-test detail (POST response + GET /{id} response) */
export interface GeneratedTestResponse {
  id: number;
  user_id: number;
  pr_url: string;
  language: TestLanguage;
  framework: TestFramework;
  test_type: TestType;
  generated_code: string;
  coverage_score: number | null;
  confidence_score: number | null;
  risk_level: string | null;
  llm_model: string | null;
  execution_time: number;
  created_at: string;
  quality: TestQualityAnalysis | null;
}

/** Compact list item (no code body) */
export interface GeneratedTestListItem {
  id: number;
  pr_url: string;
  language: TestLanguage;
  framework: TestFramework;
  test_type: TestType;
  coverage_score: number | null;
  confidence_score: number | null;
  risk_level: string | null;
  llm_model: string | null;
  execution_time: number;
  created_at: string;
}

/** Paginated wrapper for GET /api/v1/tests/history */
export interface PaginatedTestList {
  items: GeneratedTestListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Query params for the history endpoint */
export interface TestHistoryParams {
  page?: number;
  page_size?: number;
  language?: string;
  framework?: string;
}

// ── API Quality Analyzer types (mirrors app/schemas/api_quality.py) ──────────

export interface ApiIssue {
  severity: "critical" | "warning" | "info";
  category: "security" | "design" | "documentation" | "validation" | "other";
  title: string;
  description: string;
  recommendation: string;
}

export interface EndpointSummary {
  method: string;
  path: string;
  has_auth: boolean;
  has_request_schema: boolean;
  has_response_schema: boolean;
  has_description: boolean;
  issues: string[];
}

export interface ApiQualityScores {
  overall: number | null;
  security: number | null;
  documentation: number | null;
  validation: number | null;
  design: number | null;
  maintainability: number | null;
}

export interface ApiQualityAnalysis {
  executive_summary: string;
  strengths: string[];
  weaknesses: string[];
  critical_issues: ApiIssue[];
  warnings: ApiIssue[];
  recommendations: string[];
  best_practices: string[];
  scores: ApiQualityScores;
  endpoints: EndpointSummary[];
}

/** Full report returned by POST /analyze and GET /{id} */
export interface ApiQualityReport {
  id: number;
  user_id: number;
  filename: string;
  spec_version: string;
  api_title: string | null;
  api_version: string | null;
  total_endpoints: number;
  quality_score: number | null;
  security_score: number | null;
  documentation_score: number | null;
  validation_score: number | null;
  design_score: number | null;
  recommendations: string[];
  llm_model: string | null;
  execution_time: number;
  created_at: string;
  analysis: ApiQualityAnalysis;
}

/** Compact list item (no analysis_json) */
export interface ApiQualityListItem {
  id: number;
  filename: string;
  spec_version: string;
  api_title: string | null;
  api_version: string | null;
  total_endpoints: number;
  quality_score: number | null;
  security_score: number | null;
  documentation_score: number | null;
  validation_score: number | null;
  design_score: number | null;
  llm_model: string | null;
  execution_time: number;
  created_at: string;
}

/** Paginated wrapper — generic over item type. Default is ApiQualityListItem for backward compat. */
export interface PaginatedReportList<T = ApiQualityListItem> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Query params for the history endpoint */
export interface ReportHistoryParams {
  page?: number;
  page_size?: number;
}

// ── AI Security Scanner types (mirrors app/schemas/security_scanner.py) ───────

export type ScanType = "pr" | "zip" | "file";
export type FindingSeverity = "critical" | "high" | "medium" | "low";
export type ChecklistStatus = "check" | "warning" | "fail";

export interface SecurityFinding {
  severity: FindingSeverity;
  owasp_category: string;
  cwe_id: string;
  title: string;
  description: string;
  affected_file: string;
  affected_function: string;
  confidence: number;
  risk_explanation: string;
  recommendation: string;
  secure_code_example: string;
}

export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SecurityChecklistItem {
  category: string;
  item: string;
  status: ChecklistStatus;
}

export interface SecurityAnalysis {
  executive_summary: string;
  overall_security_score: number | null;
  risk_distribution: RiskDistribution;
  findings: SecurityFinding[];
  top_risks: string[];
  recommendations: string[];
  owasp_categories_found: string[];
  cwe_ids_found: string[];
  secure_coding_checklist: SecurityChecklistItem[];
}

/** Full report returned by POST /analyze and GET /{id} */
export interface SecurityScanReport {
  id: number;
  user_id: number;
  review_id: number | null;
  repository: string | null;
  branch: string | null;
  commit_sha: string | null;
  scan_type: ScanType;
  overall_security_score: number | null;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  owasp_categories: string[];
  cwe_categories: string[];
  executive_summary: string | null;
  recommendations: string[];
  llm_model: string | null;
  execution_time: number;
  created_at: string;
  analysis: SecurityAnalysis;
}

/** Compact list item — no scan_report_json */
export interface SecurityScanListItem {
  id: number;
  repository: string | null;
  branch: string | null;
  scan_type: ScanType;
  overall_security_score: number | null;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  llm_model: string | null;
  execution_time: number;
  created_at: string;
}

/** Paginated wrapper for GET /api/v1/security/history */
export interface PaginatedScanList {
  items: SecurityScanListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Query params for the security history endpoint */
export interface ScanHistoryParams {
  page?: number;
  page_size?: number;
  scan_type?: ScanType;
}

// ── Enterprise Report Generator types ────────────────────────────────────────

export type ReportType = "executive" | "developer" | "qa" | "security" | "api_quality" | "full";
export type ReportFormat = "markdown" | "html" | "json";
export type ReportModule = "reviews" | "security" | "api_quality" | "tests" | "analytics";

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  executive: "Executive Report",
  developer: "Developer Report",
  qa: "QA Report",
  security: "Security Report",
  api_quality: "API Quality Report",
  full: "Full Engineering Report",
};

export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = {
  markdown: "Markdown",
  html: "HTML",
  json: "JSON",
};

export interface ReportGenerateRequest {
  report_type: ReportType;
  report_format: ReportFormat;
  report_title?: string;
  repository?: string;
  pull_request?: string;
  date_from?: string;
  date_to?: string;
  modules?: ReportModule[];
}

export interface ReviewSummarySection {
  total_reviews: number;
  tools_used: Record<string, number>;
  avg_quality_score: number | null;
  avg_security_score: number | null;
  avg_bugs_found: number;
  avg_suggestions: number;
  avg_execution_time: number;
  recent_reviews: Record<string, unknown>[];
}

export interface SecurityReportSection {
  total_scans: number;
  avg_security_score: number | null;
  total_critical: number;
  total_high: number;
  total_medium: number;
  total_low: number;
  top_owasp_categories: string[];
  top_cwe_ids: string[];
  recent_scans: Record<string, unknown>[];
}

export interface ApiQualityReportSection {
  total_reports: number;
  avg_quality_score: number | null;
  avg_security_score: number | null;
  avg_documentation_score: number | null;
  avg_design_score: number | null;
  avg_validation_score: number | null;
  total_endpoints_analysed: number;
  recent_reports: Record<string, unknown>[];
}

export interface TestGeneratorReportSection {
  total_generated: number;
  languages_used: Record<string, number>;
  frameworks_used: Record<string, number>;
  avg_coverage_score: number | null;
  avg_confidence_score: number | null;
  recent_tests: Record<string, unknown>[];
}

export interface AnalyticsReportSection {
  repositories_analysed: number;
  pull_requests_reviewed: number;
  most_used_model: string | null;
  avg_review_time: number;
  top_repositories: Record<string, unknown>[];
}

export interface EngineeringHealthScore {
  overall: number | null;
  review_coverage: number | null;
  security_posture: number | null;
  api_quality: number | null;
  test_coverage: number | null;
  explanation: string;
}

export interface ReportPayload {
  report_type: string;
  repository: string | null;
  pull_request: string | null;
  date_from: string | null;
  date_to: string | null;
  modules_included: string[];
  engineering_health: EngineeringHealthScore;
  reviews: ReviewSummarySection | null;
  security: SecurityReportSection | null;
  api_quality: ApiQualityReportSection | null;
  tests: TestGeneratorReportSection | null;
  analytics: AnalyticsReportSection | null;
  recommendations: string[];
}

export interface GeneratedReport {
  id: number;
  user_id: number;
  repository: string | null;
  pull_request: string | null;
  report_type: string;
  report_format: string;
  report_title: string;
  summary: string | null;
  report_content: string;
  generated_at: string;
  payload: ReportPayload | null;
}

export interface ReportListItem {
  id: number;
  repository: string | null;
  pull_request: string | null;
  report_type: string;
  report_format: string;
  report_title: string;
  summary: string | null;
  generated_at: string;
}

/** Paginated wrapper for GET /api/v1/reports/history */
export type GeneratedReportList = PaginatedReportList<ReportListItem>;

export interface ReportHistoryParams {
  page?: number;
  page_size?: number;
  report_type?: ReportType;
}

// ── Team Workspace & Collaboration types ─────────────────────────────────────

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "maintainer"
  | "developer"
  | "qa_engineer"
  | "viewer";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  maintainer: "Maintainer",
  developer: "Developer",
  qa_engineer: "QA Engineer",
  viewer: "Viewer",
};

export const WORKSPACE_ROLE_COLORS: Record<WorkspaceRole, "error" | "warning" | "info" | "success" | "default"> = {
  owner: "error",
  admin: "warning",
  maintainer: "info",
  developer: "success",
  qa_engineer: "success",
  viewer: "default",
};

export interface OrgCreate {
  name: string;
  description?: string;
  avatar_url?: string;
}

export interface OrgResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceCreate {
  name: string;
  description?: string;
  avatar_url?: string;
  organization_id?: number;
}

export interface WorkspaceUpdate {
  name?: string;
  description?: string;
  avatar_url?: string;
}

export interface WorkspaceResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: number;
  organization_id: number | null;
  is_personal: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceListResponse {
  items: WorkspaceResponse[];
  total: number;
}

export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
  role: WorkspaceRole;
  joined_at: string;
}

export interface RoleUpdate {
  role: WorkspaceRole;
}

export interface InviteCreate {
  email: string;
  role: WorkspaceRole;
}

export interface WorkspaceInvite {
  id: number;
  workspace_id: number;
  invited_by: number;
  email: string;
  role: string;
  token: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expires_at: string;
  created_at: string;
}

export interface RepoAttach {
  github_owner: string;
  github_repo: string;
}

export interface WorkspaceRepo {
  id: number;
  workspace_id: number;
  github_owner: string;
  github_repo: string;
  full_name: string;
  added_by: number;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  workspace_id: number;
  user_id: number | null;
  username: string | null;
  avatar_url: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityLogList {
  items: ActivityLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface WorkspaceNotification {
  id: number;
  user_id: number;
  workspace_id: number | null;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationList {
  items: WorkspaceNotification[];
  unread_count: number;
  total: number;
}

export interface WorkspaceStats {
  total_members: number;
  total_repos: number;
  total_reviews: number;
  total_scans: number;
}

export interface WorkspaceDashboard {
  workspace: WorkspaceResponse;
  members: WorkspaceMember[];
  repositories: WorkspaceRepo[];
  recent_activity: ActivityLog[];
  unread_notifications: number;
  stats: WorkspaceStats;
}
