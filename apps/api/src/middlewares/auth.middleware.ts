import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { resolveSecret } from "../config/secrets.js";

const ACCESS_SECRET = resolveSecret("JWT_ACCESS_SECRET", {
  value: process.env.JWT_ACCESS_SECRET,
  devFallback: "dev-access-secret"
});

export type AuthenticatedRequest = Request & { user?: { id: number; role: string } };

function parseAuthUser(req: Request) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const raw = jwt.verify(token, ACCESS_SECRET) as unknown;
    const payload = raw as { sub?: number | string; role?: string };
    if (payload?.sub == null || !payload?.role) return null;
    // Storefront/customer routes must never accept admin or staff tokens, even
    // though they are signed with the same access secret.
    if (payload.role !== "customer") return null;

    const id =
      typeof payload.sub === "string"
        ? /^\d+$/.test(payload.sub)
          ? Number(payload.sub)
          : null
        : Number.isInteger(payload.sub)
          ? payload.sub
          : null;

    if (id == null) return null;
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

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = parseAuthUser(req);
  if (user) {
    (req as AuthenticatedRequest).user = user;
  } else if (req.headers.authorization !== undefined) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}
