import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

export type AuthenticatedRequest = Request & { user?: { id: number; role: string } };

function parseAuthUser(req: Request) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const raw = jwt.verify(token, ACCESS_SECRET) as unknown;
    const payload = raw as { sub?: number | string; role?: string };
    if (!payload?.sub || !payload?.role) return null;
    const id = typeof payload.sub === "string" ? Number(payload.sub) : payload.sub;
    if (!Number.isFinite(id)) return null;
    return { id, role: payload.role };
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = parseAuthUser(req);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as AuthenticatedRequest).user = user;
  return next();
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const user = parseAuthUser(req);
  if (user) {
    (req as AuthenticatedRequest).user = user;
  }
  return next();
}
