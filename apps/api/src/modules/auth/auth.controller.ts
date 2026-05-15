import type { Request, Response } from "express";
import { issueAccessToken, login, signup, verifyRefreshToken } from "./auth.service.js";

const REFRESH_COOKIE = "capella_refresh";

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
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/"
    });
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Login failed" });
  }
}

export function refreshController(req: Request, res: Response) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ message: "Missing refresh token" });
    const payload = verifyRefreshToken(token);
    const accessToken = issueAccessToken(Number(payload.sub));
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
}
