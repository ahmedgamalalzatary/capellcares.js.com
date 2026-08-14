import type { Request, Response } from "express";
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

export function adminLoginController(req: Request, res: Response) {
  loginAdmin(req.body)
    .then((result) => {
      if (!isMobileClient(req)) {
        res.cookie(ADMIN_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
      }
      res.json({
        accessToken: result.accessToken,
        user: result.user,
        ...(isMobileClient(req) ? { refreshToken: result.refreshToken } : {})
      });
    })
    .catch((error: Error) => res.status(401).json({ message: error.message }));
}

export async function adminRefreshController(req: Request, res: Response) {
  try {
    const token = extractRefreshToken(req, ADMIN_REFRESH_COOKIE);
    if (!token) return res.status(401).json({ message: "Missing refresh token" });
    const result = await refreshAdminSession(token);
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
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
}

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
