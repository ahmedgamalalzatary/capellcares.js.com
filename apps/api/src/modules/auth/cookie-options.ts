import type { CookieOptions } from "express";
import { resolveRefreshTtlMs } from "../../services/auth-session.service.js";

export const CUSTOMER_REFRESH_COOKIE = "capella_refresh";
export const ADMIN_REFRESH_COOKIE = "capella_admin_refresh";

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: resolveRefreshTtlMs()
  };
}

export function clearRefreshCookieOptions(): CookieOptions {
  return {
    ...refreshCookieOptions(),
    maxAge: 0
  };
}
