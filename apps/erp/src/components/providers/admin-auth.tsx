"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface AdminUser { name: string; email: string }
interface AdminAuthValue {
  user: AdminUser | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
}

const Ctx = createContext<AdminAuthValue | null>(null);
const KEY = "capella.admin.v1";

const ADMIN_EMAIL = "admin@capella.eg";
const ADMIN_PASS = "admin1234";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (user) sessionStorage.setItem(KEY, JSON.stringify(user));
      else sessionStorage.removeItem(KEY);
    } catch {}
  }, [user, hydrated]);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    await new Promise((r) => setTimeout(r, 400));
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASS) {
      setUser({ name: "Capella Admin", email });
      return { ok: true };
    }
    return { ok: false, error: "بيانات الدخول غير صحيحة" };
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo<AdminAuthValue>(() => ({ user, hydrated, login, logout }), [user, hydrated, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return c;
}

export const ADMIN_CREDENTIALS_HINT = { email: ADMIN_EMAIL, password: ADMIN_PASS };
