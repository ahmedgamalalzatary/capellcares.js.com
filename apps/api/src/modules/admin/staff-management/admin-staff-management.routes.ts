import type { NextFunction, Response } from "express";
import { Router } from "express";
import type { ErpAuthenticatedRequest } from "../../../middlewares/admin-auth.middleware.js";
import {
  createAdminStaffController,
  listAdminStaffController,
  listStaffPermissionCatalogController,
  updateAdminStaffController
} from "./admin-staff-management.controller.js";

function requireAdminRole(req: ErpAuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.adminUser?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

function wrapAsync(
  handler: (req: ErpAuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: ErpAuthenticatedRequest, res: Response, next: NextFunction) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export const adminStaffManagementRoutes = Router();

adminStaffManagementRoutes.use(requireAdminRole);
adminStaffManagementRoutes.get("/permissions", wrapAsync(listStaffPermissionCatalogController));
adminStaffManagementRoutes.get("/", wrapAsync(listAdminStaffController));
adminStaffManagementRoutes.post("/", wrapAsync(createAdminStaffController));
adminStaffManagementRoutes.put("/:id", wrapAsync(updateAdminStaffController));
