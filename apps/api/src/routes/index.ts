import { Router } from "express";
import { catalogRoutes } from "../modules/catalog/catalog.routes.js";
import { adminRoutes } from "../modules/admin/admin.routes.js";

export const apiRoutes = Router();

apiRoutes.get("/health", (_req, res) => res.json({ ok: true }));
apiRoutes.use("/api/v1", catalogRoutes);
apiRoutes.use("/api/erp", adminRoutes);
