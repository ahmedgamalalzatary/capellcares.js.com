import type { Request, Response } from "express";
import { login, logoutCustomerSession, refreshCustomerSession, signup } from "./auth.service.js";
import {
  clearRefreshCookieOptions,
  CUSTOMER_REFRESH_COOKIE,
  LEGACY_CUSTOMER_REFRESH_COOKIE,
  refreshCookieOptions
} from "./cookie-options.js";

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
    res.cookie(CUSTOMER_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Login failed" });
  }
}

export async function refreshController(req: Request, res: Response) {
  try {
    const token = req.cookies?.[CUSTOMER_REFRESH_COOKIE] ?? req.cookies?.[LEGACY_CUSTOMER_REFRESH_COOKIE];
    if (!token) return res.status(401).json({ message: "Missing refresh token" });
    const result = await refreshCustomerSession(token);
    res.cookie(CUSTOMER_REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    return res.json({ accessToken: result.accessToken });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function logoutController(req: Request, res: Response) {
  const token = req.cookies?.[CUSTOMER_REFRESH_COOKIE] ?? req.cookies?.[LEGACY_CUSTOMER_REFRESH_COOKIE];
  if (token) {
    await logoutCustomerSession(token);
  }
  res.cookie(CUSTOMER_REFRESH_COOKIE, "", clearRefreshCookieOptions());
  res.cookie(LEGACY_CUSTOMER_REFRESH_COOKIE, "", clearRefreshCookieOptions());
  return res.status(204).send();
}
