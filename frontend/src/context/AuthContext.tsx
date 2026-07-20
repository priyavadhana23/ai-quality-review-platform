/**
 * AuthContext — single source of truth for authentication state.
 *
 * Responsibilities:
 *  - Parse tokens from the OAuth callback URL on first mount.
 *  - Restore session from localStorage on every page load.
 *  - Expose user, accessToken, isAuthenticated, login, logout, refreshSession.
 *  - Wire the Axios client so every request carries the current Bearer token.
 */
import React, { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
  setAccessToken,
  setOnRefreshFailure,
  setRefreshToken,
  getStoredRefreshToken,
} from "@/api/client";
import { authApi } from "@/api";
import type { AuthContextValue, User } from "@/types";

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  refreshSession: async () => false,
});

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Decode the JWT payload without verifying the signature.
 * Verification happens server-side; we only read claims for UI state.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  // Give a 30-second buffer before the real expiry.
  return payload.exp * 1000 < Date.now() + 30_000;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const _storeTokens = useCallback((access: string, refresh: string) => {
    setAccessTokenState(access);
    setAccessToken(access); // wire Axios interceptor
    setRefreshToken(refresh);
  }, []);

  const _clearSession = useCallback(() => {
    setUser(null);
    setAccessTokenState(null);
    setAccessToken(null);
    setRefreshToken(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  // Schedule a silent refresh 60 seconds before the access token expires.
  const _scheduleRefresh = useCallback(
    (token: string, rawRefresh: string) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      const payload = decodeJwtPayload(token);
      if (!payload || typeof payload.exp !== "number") return;
      const msUntilExpiry = payload.exp * 1000 - Date.now();
      const delay = Math.max(msUntilExpiry - 60_000, 10_000);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const resp = await authApi.refresh(rawRefresh);
          const storedRefresh = getStoredRefreshToken();
          if (storedRefresh) {
            _storeTokens(resp.access_token, storedRefresh);
            _scheduleRefresh(resp.access_token, storedRefresh);
          }
        } catch {
          _clearSession();
        }
      }, delay);
    },
    [_storeTokens, _clearSession],
  );

  // ── Public actions ─────────────────────────────────────────────────────────

  const login = useCallback(() => {
    authApi.initiateLogin();
  }, []);

  const logout = useCallback(async () => {
    const storedRefresh = getStoredRefreshToken();
    if (storedRefresh) {
      try {
        await authApi.logout(storedRefresh);
      } catch {
        /* best-effort */
      }
    }
    _clearSession();
  }, [_clearSession]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const storedRefresh = getStoredRefreshToken();
    if (!storedRefresh) return false;
    try {
      const resp = await authApi.refresh(storedRefresh);
      const newRefresh = getStoredRefreshToken()!;
      _storeTokens(resp.access_token, newRefresh);
      const profile = await authApi.me();
      setUser(profile);
      _scheduleRefresh(resp.access_token, newRefresh);
      return true;
    } catch {
      _clearSession();
      return false;
    }
  }, [_storeTokens, _clearSession, _scheduleRefresh]);

  // ── Initialisation: parse callback URL or restore from storage ─────────────
  useEffect(() => {
    // Tell the Axios client to call _clearSession on unrecoverable 401.
    setOnRefreshFailure(_clearSession);

    const init = async () => {
      try {
        // 1. Check if this is the OAuth callback page (token in URL hash + query).
        const hash = window.location.hash; // #access_token=...
        const query = new URLSearchParams(window.location.search);
        const refreshFromUrl = query.get("refresh_token");
        const accessFromHash = hash.startsWith("#access_token=")
          ? hash.slice("#access_token=".length)
          : null;

        if (accessFromHash && refreshFromUrl) {
          _storeTokens(accessFromHash, refreshFromUrl);
          // Clean the tokens out of the URL immediately.
          window.history.replaceState({}, "", window.location.pathname);
          const profile = await authApi.me();
          setUser(profile);
          _scheduleRefresh(accessFromHash, refreshFromUrl);
          return;
        }

        // 2. Try to restore from a stored refresh token.
        const storedRefresh = getStoredRefreshToken();
        if (storedRefresh) {
          try {
            const resp = await authApi.refresh(storedRefresh);
            const newRefresh = getStoredRefreshToken()!;
            _storeTokens(resp.access_token, newRefresh);
            const profile = await authApi.me();
            setUser(profile);
            _scheduleRefresh(resp.access_token, newRefresh);
          } catch {
            _clearSession();
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
