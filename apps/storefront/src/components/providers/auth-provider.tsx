"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest, logoutRequest, refreshAccessToken, signupRequest } from "./lib/auth-provider.api";
import { readStoredAuthUser, writeStoredAuthUser } from "./lib/auth-provider.storage";
import type { AuthContextValue, AuthProviderProps, AuthUser } from "./auth-provider.types";

const AuthContext = createContext<AuthContextValue | null>(null);

export type { AuthContextValue, AuthProviderProps, AuthUser } from "./auth-provider.types";

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

    refreshAccessToken()
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            if (!cancelled) {
              console.error("[auth] Refresh token rejected, clearing session");
              setUser(null);
              setAccessToken(null);
            }
          } else {
            console.error(`[auth] Refresh failed with status ${res.status}`);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAccessToken(data.accessToken ?? null);
        }
      })
      .catch((err) => {
        console.error("[auth] Refresh request failed:", err?.message ?? err);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, user, accessToken]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredAuthUser(user);
  }, [user, accessToken, hydrated]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await loginRequest(email, password);
    setUser(data.user);
    setAccessToken(data.accessToken);
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
      setAccessToken(null);
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
