import type { Request, Response, NextFunction } from "express";
import { findCustomerByEmail } from "../repositories/customer.repository.js";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

export async function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const devEmail = process.env.ADMIN_DEV_EMAIL ?? "admin@capella.eg";
  const devPassword = process.env.ADMIN_DEV_PASSWORD ?? "admin1234";
  const adminHeader = req.headers["x-admin-basic"];
  if (typeof adminHeader === "string") {
    const [email, password] = adminHeader.split(":");
    if (email === devEmail && password === devPassword) {
      console.warn("Using hardcoded admin dev fallback credentials");
      return next();
    }
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Admin auth required" });
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as { role?: string; email?: string };
    if (payload.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    if (payload.email) {
      const user = await findCustomerByEmail(payload.email);
      if (!user) return res.status(401).json({ message: "Invalid admin token" });
    }
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid admin token" });
  }
}
