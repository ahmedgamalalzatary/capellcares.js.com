import { Router } from "express";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import {
  deleteAdviceController,
  listAdminAdvicesController,
  toggleAdviceStatusController,
  upsertAdviceController
} from "./admin-advices.controller.js";

export const adminAdvicesRoutes = Router();
adminAdvicesRoutes.get("/", requireErpPermission("advices.read"), listAdminAdvicesController);
adminAdvicesRoutes.post("/", requireErpPermission((req) => (req.body?.id ? "advices.update" : "advices.create")), upsertAdviceController);
adminAdvicesRoutes.post("/:id/toggle-status", requireErpPermission("advices.toggle_status"), toggleAdviceStatusController);
adminAdvicesRoutes.delete("/:id", requireErpPermission("advices.delete"), deleteAdviceController);
