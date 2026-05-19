import { Router } from "express";
import {
  deleteAdviceController,
  listAdminAdvicesController,
  toggleAdviceStatusController,
  upsertAdviceController
} from "./advices.controller.js";

export const adminAdvicesRoutes = Router();
adminAdvicesRoutes.get("/", listAdminAdvicesController);
adminAdvicesRoutes.post("/", upsertAdviceController);
adminAdvicesRoutes.post("/:id/toggle-status", toggleAdviceStatusController);
adminAdvicesRoutes.delete("/:id", deleteAdviceController);
