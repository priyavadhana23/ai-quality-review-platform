/**
 * Axios instance — the single HTTP client for the entire frontend.
 *
 * Intercepts every request to attach the Bearer access token stored in
 * AuthContext, and handles 401 responses by attempting a token refresh
 * before retrying the original request once.
 */
import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 300_000,
  headers: { "Content-Type": "application/json" },
});

// ── Token storage (module-level so interceptors can access it) ────────────────
// The AuthContext calls setAccessToken() after login/refresh so the client
// always sends the latest token without needing a React Context import here.

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _onRefreshFailure: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function setRefreshToken(token: string | null): void {
  _refreshToken = token;
  if (token) {
    try {
      localStorage.setItem("qrp_refresh_token", token);
    } catch {
      /* storage unavailable */
    }
  } else {
    try {
      localStorage.removeItem("qrp_refresh_token");
    } catch {
      /* storage unavailable */
    }
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem("qrp_refresh_token");
  } catch {
    return null;
  }
}

export function setOnRefreshFailure(callback: () => void): void {
  _onRefreshFailure = callback;
}

// ── Request interceptor — attach Bearer token ─────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessToken) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${_accessToken}`;
  }
  if (import.meta.env.DEV) {
    console.debug(`[API] → ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

// ── Response interceptor — auto-refresh on 401 ───────────────────────────────
let _isRefreshing = false;
let _failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function _processQueue(error: unknown, token: string | null): void {
  _failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  _failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh for 401s on non-auth endpoints and only once.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.startsWith("/auth/")
    ) {
      if (_isRefreshing) {
        // Queue concurrent requests while refresh is in-flight.
        return new Promise((resolve, reject) => {
          _failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      _isRefreshing = true;

      const storedRefresh = _refreshToken ?? getStoredRefreshToken();
      if (!storedRefresh) {
        _isRefreshing = false;
        _onRefreshFailure?.();
        return Promise.reject(error);
      }

      try {
        const { data } = await apiClient.post<{ access_token: string }>("/auth/refresh", {
          refresh_token: storedRefresh,
        });
        const newToken = data.access_token;
        setAccessToken(newToken);
        _processQueue(null, newToken);
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        _processQueue(refreshError, null);
        _onRefreshFailure?.();
        return Promise.reject(refreshError);
      } finally {
        _isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
