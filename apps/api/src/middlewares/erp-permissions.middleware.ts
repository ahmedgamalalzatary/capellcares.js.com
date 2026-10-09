import type { NextFunction, Response } from "express";
import type { ErpAuthenticatedRequest } from "./admin-auth.middleware.js";
import { hasErpPermission, type ErpPermissionKey } from "../services/erp-permissions.service.js";

type PermissionResolver = ErpPermissionKey | ((req: ErpAuthenticatedRequest) => ErpPermissionKey | null);

async function resolvePermission(permission: PermissionResolver, req: ErpAuthenticatedRequest) {
  return typeof permission === "function" ? permission(req) : permission;
}

export function requireErpPermission(permission: PermissionResolver) {
  const middleware = async function erpPermissionMiddleware(req: ErpAuthenticatedRequest, res: Response, next: NextFunction) {
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

    if (!(await hasErpPermission(adminUser.id, resolvedPermission))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };

  // Express 4 ignores rejected promises; forward a failed permission lookup to the error middleware instead of crashing the process.
  return (req: ErpAuthenticatedRequest, res: Response, next: NextFunction) => {
    void middleware(req, res, next).catch(next);
  };
}
