import { Router } from "express";
import { adminAuthMiddleware } from "../middlewares/admin-auth.middleware.js";
import { adminRoutes } from "../modules/admin/admin.routes.js";
import { adminAuthRoutes } from "../modules/admin/auth/admin-auth.routes.js";
import { uploadsRoutes } from "../modules/uploads/uploads.routes.js";

export const erpRoutes = Router();
erpRoutes.use("/auth", adminAuthRoutes);
erpRoutes.use(adminAuthMiddleware);

erpRoutes.use("/", adminRoutes);
erpRoutes.use("/uploads", uploadsRoutes);
