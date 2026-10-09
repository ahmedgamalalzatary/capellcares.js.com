import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import {
  deleteAdviceController,
  listAdminAdvicesController,
  reorderAdvicesController,
  toggleAdviceStatusController,
  upsertAdviceController
} from "./admin-advices.controller.js";

export const adminAdvicesRoutes = Router();
adminAdvicesRoutes.get("/", requireErpPermission("advices.read"), wrapAsync(listAdminAdvicesController));
adminAdvicesRoutes.post("/", requireErpPermission((req) => (req.body?.id ? "advices.update" : "advices.create")), wrapAsync(upsertAdviceController));
adminAdvicesRoutes.post("/reorder", requireErpPermission("advices.update"), wrapAsync(reorderAdvicesController));
adminAdvicesRoutes.post("/:id/toggle-status", requireErpPermission("advices.toggle_status"), wrapAsync(toggleAdviceStatusController));
adminAdvicesRoutes.delete("/:id", requireErpPermission("advices.delete"), wrapAsync(deleteAdviceController));
