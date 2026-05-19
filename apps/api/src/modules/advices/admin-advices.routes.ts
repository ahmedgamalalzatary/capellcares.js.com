import { Router } from "express";
import {
  deleteAdviceController,
  listAdminAdvicesController,
  upsertAdviceController
} from "./advices.controller.js";

export const adminAdvicesRoutes = Router();
adminAdvicesRoutes.get("/", listAdminAdvicesController);
adminAdvicesRoutes.post("/", upsertAdviceController);
adminAdvicesRoutes.delete("/:id", deleteAdviceController);
