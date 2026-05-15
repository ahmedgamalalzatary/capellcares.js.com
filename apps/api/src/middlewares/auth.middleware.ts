import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

export type AuthenticatedRequest = Request & { user?: { id: number; role: string } };

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const raw = jwt.verify(token, ACCESS_SECRET) as unknown;
    const payload = raw as { sub?: number | string; role?: string };
    if (!payload?.sub || !payload?.role) return res.status(401).json({ message: "Unauthorized" });
    (req as AuthenticatedRequest).user = { id: Number(payload.sub), role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
