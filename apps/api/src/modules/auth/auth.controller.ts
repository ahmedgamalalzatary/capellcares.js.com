import type { Request, Response } from "express";
import { login, logoutCustomerSession, refreshCustomerSession, signup } from "./auth.service.js";
import {
  clearRefreshCookieOptions,
  CUSTOMER_REFRESH_COOKIE,
  refreshCookieOptions
} from "./cookie-options.js";
import { canExposeRefreshToken, extractRefreshToken, isMobileClient } from "./mobile-client.js";

export async function signupController(req: Request, res: Response) {
  try {
    const user = await signup(req.body);
    res.status(201).json({ user });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Signup failed" });
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    const result = await login(req.body);
    if (!isMobileClient(req)) {
      res.cookie(CUSTOMER_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    }
    res.json({
      accessToken: result.accessToken,
      user: result.user,
      ...(isMobileClient(req) ? { refreshToken: result.refreshToken } : {})
    });
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Login failed" });
  }
}

export async function refreshController(req: Request, res: Response) {
  try {
    const token = extractRefreshToken(req, CUSTOMER_REFRESH_COOKIE);
    if (!token) return res.status(401).json({ message: "Missing refresh token" });
    const result = await refreshCustomerSession(token);
    if (!isMobileClient(req)) {
      res.cookie(CUSTOMER_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    }
    return res.json({
      accessToken: result.accessToken,
      ...(canExposeRefreshToken(req, CUSTOMER_REFRESH_COOKIE)
        ? { refreshToken: result.refreshToken }
        : {})
    });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
}

async function handleLogout(
  req: Request,
  res: Response,
  revokeSession: typeof logoutCustomerSession
) {
  const token = extractRefreshToken(req, CUSTOMER_REFRESH_COOKIE);
  if (token) {
    try {
      await revokeSession(token);
    } catch (error) {
      console.warn("Failed to revoke customer session during logout", error);
    }
  }
  if (!isMobileClient(req)) {
    res.cookie(CUSTOMER_REFRESH_COOKIE, "", clearRefreshCookieOptions());
  }
  return res.status(204).send();
}

export function createLogoutController(
  revokeSession: typeof logoutCustomerSession = logoutCustomerSession
) {
  return (req: Request, res: Response) => handleLogout(req, res, revokeSession);
}

export async function logoutController(req: Request, res: Response) {
  return handleLogout(req, res, logoutCustomerSession);
}
