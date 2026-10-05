import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { findActiveAuthSessionById } from "../modules/auth/auth-session.repository.js";
import { resolveSecret } from "../config/secrets.js";

const ACCESS_SECRET = resolveSecret("JWT_ACCESS_SECRET", {
  value: process.env.JWT_ACCESS_SECRET,
  devFallback: "dev-access-secret"
});

export type AuthenticatedRequest = Request & { user?: { id: number; role: string } };

export type AuthSessionRecord = { customerId: number | null };
export type SessionResolver = (id: number, accountType: "customer") => Promise<AuthSessionRecord | null>;

function createParseAuthUser(resolveSession: SessionResolver) {
  return async function parseAuthUser(req: Request) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return null;

    let raw: unknown;
    try {
      raw = jwt.verify(token, ACCESS_SECRET);
    } catch {
      return null;
    }

    const payload = raw as { sub?: number | string; role?: string; sid?: unknown };
    if (payload?.sub == null || !payload?.role) return null;
    // Storefront/customer routes must never accept admin or staff tokens, even though they are signed with the same access secret.
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

    // Production access tokens carry the id of the session they were issued for. Consult it so logging out or rotating a session revokes its already-issued access tokens immediately instead of at expiry. Tokens without a session id (legacy/test-minted) keep stateless validation. A lookup failure is deliberately NOT caught here: it must surface as a server error, not a 401, so an outage does not look like an invalid token.
    if (payload.sid != null) {
      const sid = typeof payload.sid === "number" && Number.isInteger(payload.sid) ? payload.sid : null;
      if (sid == null) return null;
      const session = await resolveSession(sid, "customer");
      if (!session || session.customerId !== id) return null;
    }

    return { id, role: payload.role };
  };
}

export function createAuthMiddleware(resolveSession: SessionResolver = findActiveAuthSessionById) {
  const parseAuthUser = createParseAuthUser(resolveSession);
  return async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    let user: { id: number; role: string } | null;
    try {
      user = await parseAuthUser(req);
    } catch (error) {
      console.error("Failed to verify customer session", error);
      return res.status(503).json({ message: "Unable to verify session" });
    }
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    (req as AuthenticatedRequest).user = user;
    return next();
  };
}

export function createOptionalAuthMiddleware(resolveSession: SessionResolver = findActiveAuthSessionById) {
  const parseAuthUser = createParseAuthUser(resolveSession);
  return async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    let user: { id: number; role: string } | null;
    try {
      user = await parseAuthUser(req);
    } catch (error) {
      console.error("Failed to verify customer session", error);
      return res.status(503).json({ message: "Unable to verify session" });
    }
    if (user) {
      (req as AuthenticatedRequest).user = user;
    } else if (req.headers.authorization !== undefined) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return next();
  };
}

export const authMiddleware = createAuthMiddleware();
export const optionalAuthMiddleware = createOptionalAuthMiddleware();
