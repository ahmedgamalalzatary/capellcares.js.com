import { Router } from "express";
import { storefrontRoutes } from "./storefront.routes.js";
import { erpRoutes } from "./erp.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/api/v1", storefrontRoutes);
apiRoutes.use("/api/erp", erpRoutes);
