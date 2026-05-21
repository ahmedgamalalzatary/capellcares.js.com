import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { findAdminUserById } from "../repositories/admin-user.repository.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

export async function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Admin auth required" });
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as { sub?: number | string; role?: string; type?: string };
    if (payload.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    if (payload.type !== "admin_access") return res.status(403).json({ message: "Forbidden" });
    let adminId: number | null = null;
    if (typeof payload.sub === "string" && /^\d+$/.test(payload.sub)) {
      adminId = Number(payload.sub);
    } else if (typeof payload.sub === "number" && Number.isInteger(payload.sub)) {
      adminId = payload.sub;
    }
    if (adminId == null) return res.status(401).json({ message: "Invalid admin token" });
    const admin = await findAdminUserById(adminId);
    if (!admin) return res.status(401).json({ message: "Invalid admin token" });
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid admin token" });
  }
}
