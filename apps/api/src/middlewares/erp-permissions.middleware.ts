import type { NextFunction, Response } from "express";
import type { ErpAuthenticatedRequest } from "./admin-auth.middleware.js";
import { hasErpPermission, syncPermissionCatalog, type ErpPermissionKey } from "../services/erp-permissions.service.js";

type PermissionResolver = ErpPermissionKey | ((req: ErpAuthenticatedRequest) => ErpPermissionKey | null);

async function resolvePermission(permission: PermissionResolver, req: ErpAuthenticatedRequest) {
  return typeof permission === "function" ? permission(req) : permission;
}

export function requireErpPermission(permission: PermissionResolver) {
  return async function erpPermissionMiddleware(req: ErpAuthenticatedRequest, res: Response, next: NextFunction) {
    const adminUser = req.adminUser;
    if (!adminUser) {
      return res.status(401).json({ message: "Admin auth required" });
    }

    if (adminUser.role === "admin") {
      return next();
    }

    const resolvedPermission = await resolvePermission(permission, req);
    if (!resolvedPermission) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await syncPermissionCatalog();
    if (!(await hasErpPermission(adminUser.id, resolvedPermission))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}
