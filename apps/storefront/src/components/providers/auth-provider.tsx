"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  loginRequest,
  logoutRequest,
  getAuthSessionRevision,
  getCurrentAccessToken,
  refreshAccessTokenOrNull,
  setCurrentAccessToken,
  subscribeCurrentAccessToken,
  signupRequest
} from "../../lib/auth-provider.api";
import { readStoredAuthUser, writeStoredAuthUser } from "../../lib/auth-provider.storage";
import type { AuthContextValue, AuthProviderProps, AuthUser } from "../../types/auth-provider.types";

const AuthContext = createContext<AuthContextValue | null>(null);
const REFRESH_RETRY_MS = 30_000;

function decodeTokenExpiryMs(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(normalized)) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(readStoredAuthUser());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !user || accessToken) return;

    let cancelled = false;
    let retryTimer: number | undefined;
    const refreshBootstrap = async () => {
      const revision = getAuthSessionRevision();
      const token = await refreshAccessTokenOrNull();
      if (cancelled || token) return;

      if (getAuthSessionRevision() !== revision) {
        if (!getCurrentAccessToken()) {
          console.error("[auth] Refresh token rejected, clearing session");
          setUser(null);
        }
        return;
      }

      retryTimer = window.setTimeout(() => void refreshBootstrap(), REFRESH_RETRY_MS);
    };
    void refreshBootstrap();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [hydrated, user, accessToken]);

  useEffect(() => {
    const unsubscribe = subscribeCurrentAccessToken(setAccessToken);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setCurrentAccessToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const expiryMs = decodeTokenExpiryMs(accessToken);
    if (!expiryMs) {
      return;
    }

    const refreshInMs = Math.max(expiryMs - Date.now() - 60_000, 5_000);
    let timer: number;
    let cancelled = false;
    const refreshAndRetry = async () => {
      const refreshedToken = await refreshAccessTokenOrNull();
      if (!cancelled && !refreshedToken && getCurrentAccessToken() === accessToken) {
        timer = window.setTimeout(() => void refreshAndRetry(), REFRESH_RETRY_MS);
      }
    };
    timer = window.setTimeout(() => void refreshAndRetry(), refreshInMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredAuthUser(user);
  }, [user, accessToken, hydrated]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await loginRequest(email, password);
    setUser(data.user);
    setCurrentAccessToken(data.accessToken);
    return data.user;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<AuthUser> => {
    await signupRequest(name, email, password);
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setCurrentAccessToken(null);
    }
  }, []);

  const value = useMemo(() => ({ user, accessToken, login, signup, logout }), [user, accessToken, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
