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

export const adminStaffManagementRoutes = Router();

adminStaffManagementRoutes.use(requireAdminRole);
adminStaffManagementRoutes.get("/permissions", listStaffPermissionCatalogController);
adminStaffManagementRoutes.get("/", listAdminStaffController);
adminStaffManagementRoutes.post("/", createAdminStaffController);
adminStaffManagementRoutes.put("/:id", updateAdminStaffController);
