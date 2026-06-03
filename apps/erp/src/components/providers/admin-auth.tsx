"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API_BASE, setAdminAccessToken, setAdminAuthHydrated, setAdminAuthUser, subscribeAdminSessionInvalidation, type AdminAuthUser } from "@/lib/api/client";
interface AdminAuthValue {
  user: AdminAuthUser | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AdminAuthValue | null>(null);
const KEY = "capella.admin.v1";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminAuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAdminAuthHydrated(false);
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AdminAuthUser>;
        const role = parsed.role === "admin" || parsed.role === "staff" ? parsed.role : "staff";
        setUser({
          name: parsed.name ?? "",
          email: parsed.email ?? "",
          role,
          permissionKeys: Array.isArray(parsed.permissionKeys) ? parsed.permissionKeys : []
        });
      }
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
          setUser(data.user ?? null);
          setAdminAuthUser(data.user ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setAdminAuthUser(null);
        }
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

  useEffect(() => subscribeAdminSessionInvalidation(() => {
    setUser(null);
    setAdminAccessToken(null);
    setAdminAuthUser(null);
  }), []);

  useEffect(() => {
    setAdminAuthUser(user);
  }, [user]);

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
      setAdminAuthUser(data.user);
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
      setAdminAuthUser(null);
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
