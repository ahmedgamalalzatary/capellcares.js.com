import type { Request, Response } from "express";
import {
  clearRefreshCookieOptions,
  ADMIN_REFRESH_COOKIE,
  LEGACY_ADMIN_REFRESH_COOKIE,
  refreshCookieOptions
} from "../../auth/cookie-options.js";
import { loginAdmin, logoutAdminSession, refreshAdminSession } from "./admin-auth.service.js";

export function adminLoginController(req: Request, res: Response) {
  loginAdmin(req.body)
    .then((result) => {
      res.cookie(ADMIN_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
      res.json({ accessToken: result.accessToken, user: result.user });
    })
    .catch((error: Error) => res.status(401).json({ message: error.message }));
}

export async function adminRefreshController(req: Request, res: Response) {
  try {
    const token = req.cookies?.[ADMIN_REFRESH_COOKIE] ?? req.cookies?.[LEGACY_ADMIN_REFRESH_COOKIE];
    if (!token) return res.status(401).json({ message: "Missing refresh token" });
    const result = await refreshAdminSession(token);
    res.cookie(ADMIN_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    return res.json({ accessToken: result.accessToken, user: result.user });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function adminLogoutController(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_REFRESH_COOKIE] ?? req.cookies?.[LEGACY_ADMIN_REFRESH_COOKIE];
  if (token) {
    await logoutAdminSession(token);
  }
  res.cookie(ADMIN_REFRESH_COOKIE, "", clearRefreshCookieOptions());
  res.cookie(LEGACY_ADMIN_REFRESH_COOKIE, "", clearRefreshCookieOptions());
  return res.status(204).send();
}
