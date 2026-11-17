import type { NextFunction, Request, Response } from "express";
import { InvalidCredentialsError } from "../../auth/auth-errors.js";
import {
  clearRefreshCookieOptions,
  ADMIN_REFRESH_COOKIE,
  refreshCookieOptions
} from "../../auth/cookie-options.js";
import {
  canExposeRefreshToken,
  extractRefreshToken,
  isMobileClient
} from "../../auth/mobile-client.js";
import { loginAdmin, logoutAdminSession, refreshAdminSession } from "./admin-auth.service.js";
import { RefreshTokenRejectedError } from "../../../services/auth-session.service.js";

export function createAdminLoginController(login: typeof loginAdmin = loginAdmin) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await login(req.body);
      if (!isMobileClient(req)) {
        res.cookie(ADMIN_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
      }
      res.json({
        accessToken: result.accessToken,
        user: result.user,
        ...(isMobileClient(req) ? { refreshToken: result.refreshToken } : {})
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        console.warn(`Failed admin login for ${email || "(no email)"} from ${req.ip ?? "unknown"}`);
        return res.status(401).json({ message: error.message });
      }
      return next(error);
    }
  };
}

export const adminLoginController = createAdminLoginController();

export function createAdminRefreshController(
  refreshSession: typeof refreshAdminSession = refreshAdminSession
) {
  return async (req: Request, res: Response) => {
    const token = extractRefreshToken(req, ADMIN_REFRESH_COOKIE);
    if (!token) return res.status(401).json({ message: "Missing refresh token" });
    try {
      const result = await refreshSession(token);
      if (!isMobileClient(req)) {
        res.cookie(ADMIN_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
      }
      return res.json({
        accessToken: result.accessToken,
        user: result.user,
        ...(canExposeRefreshToken(req, ADMIN_REFRESH_COOKIE)
          ? { refreshToken: result.refreshToken }
          : {})
      });
    } catch (error) {
      // A genuine rejection is safe to surface as 401; an operational failure must not be reported as a bad token, or clients would erase a session the outage did not invalidate.
      if (error instanceof RefreshTokenRejectedError) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      console.error("Failed to refresh admin session", error);
      return res.status(500).json({ message: "Unable to refresh session" });
    }
  };
}

export const adminRefreshController = createAdminRefreshController();

async function handleAdminLogout(
  req: Request,
  res: Response,
  revokeSession: typeof logoutAdminSession
) {
  const token = extractRefreshToken(req, ADMIN_REFRESH_COOKIE);
  if (token) {
    try {
      await revokeSession(token);
    } catch (error) {
      console.warn("Failed to revoke admin session during logout", error);
    }
  }
  if (!isMobileClient(req)) {
    res.cookie(ADMIN_REFRESH_COOKIE, "", clearRefreshCookieOptions());
  }
  return res.status(204).send();
}

export function createAdminLogoutController(
  revokeSession: typeof logoutAdminSession = logoutAdminSession
) {
  return (req: Request, res: Response) => handleAdminLogout(req, res, revokeSession);
}

export async function adminLogoutController(req: Request, res: Response) {
  return handleAdminLogout(req, res, logoutAdminSession);
}
