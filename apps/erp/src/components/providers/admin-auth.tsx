"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_BASE, setAdminAccessToken, setAdminAuthHydrated } from "@/lib/api/client";

type AdminUserRole = "admin" | "staff";

interface AdminUser {
  name: string;
  email: string;
  role: AdminUserRole;
}
interface AdminAuthValue {
  user: AdminUser | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AdminAuthValue | null>(null);
const KEY = "capella.admin.v1";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAdminAuthHydrated(false);
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}

    fetch(`${API_BASE}/api/erp/auth/refresh`, {
      method: "POST",
      credentials: "include"
    })
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAdminAccessToken(data.accessToken ?? null);
          if (data.user) setUser(data.user);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) {
          setHydrated(true);
          setAdminAuthHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (user) sessionStorage.setItem(KEY, JSON.stringify(user));
      else sessionStorage.removeItem(KEY);
    } catch {}
  }, [user, hydrated]);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const res = await fetch(`${API_BASE}/api/erp/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      setAdminAccessToken(data.accessToken);
      return { ok: true };
    }
    return { ok: false, error: "بيانات الدخول غير صحيحة" };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/erp/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } finally {
      setUser(null);
      setAdminAccessToken(null);
    }
  }, []);

  const value = useMemo<AdminAuthValue>(() => ({ user, hydrated, login, logout }), [user, hydrated, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return c;
}
