import { Router } from "express";
import { storefrontRoutes } from "./storefront.routes.js";
import { erpRoutes } from "./erp.routes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", (_req, res) => res.json({ ok: true }));
apiRoutes.use("/api/v1", storefrontRoutes);
apiRoutes.use("/api/erp", erpRoutes);
