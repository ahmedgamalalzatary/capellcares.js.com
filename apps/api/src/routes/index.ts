import { Router } from "express";
import { storefrontRoutes } from "./storefront.routes.js";
import { erpRoutes } from "./erp.routes.js";
import { mysqlPool } from "@capella/database/src/db";
import { appPolicyRoutes } from "../modules/app-policy/app-policy.js";

export const apiRoutes = Router();
apiRoutes.use(appPolicyRoutes);

apiRoutes.get("/health", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    await mysqlPool.query({ sql: "SELECT 1", timeout: 3000 });
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});
apiRoutes.use("/api/v1", storefrontRoutes);
apiRoutes.use("/api/erp", erpRoutes);
