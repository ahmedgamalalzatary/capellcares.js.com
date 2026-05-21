"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "capella.auth.v1";
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !user || accessToken) return;

    let cancelled = false;

    fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include"
    })
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
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [user, accessToken, hydrated]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();
    setUser(data.user);
    setAccessToken(data.accessToken);
    return data.user;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<AuthUser> => {
    const r1 = await fetch(`${API_BASE}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (!r1.ok) throw new Error("Signup failed");
    return login(email, password);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
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
