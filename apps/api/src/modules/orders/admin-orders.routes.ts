import { Router } from "express";
import {
  getAdminOrderController,
  listAdminOrdersController,
  updateOrderPaymentStatusController
} from "./orders.controller.js";

export const adminOrdersRoutes = Router();
adminOrdersRoutes.get("/", listAdminOrdersController);
adminOrdersRoutes.get("/:id", getAdminOrderController);
adminOrdersRoutes.post("/:id/payment-status", updateOrderPaymentStatusController);
