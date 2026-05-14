import { Router } from "express";
import { adminAuthMiddleware } from "../middlewares/admin-auth.middleware.js";
import { adminProductsRoutes } from "../modules/admin/products/admin-products.routes.js";

export const erpRoutes = Router();
erpRoutes.use(adminAuthMiddleware);

erpRoutes.use("/products", adminProductsRoutes);
