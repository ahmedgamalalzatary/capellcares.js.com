import { Router } from "express";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import {
  getAdminOrderController,
  listAdminOrdersController,
  updateOrderPaymentStatusController
} from "./orders.controller.js";

export const adminOrdersRoutes = Router();
adminOrdersRoutes.get("/", requireErpPermission("orders.read"), listAdminOrdersController);
adminOrdersRoutes.get("/:id", requireErpPermission("orders.read"), getAdminOrderController);
adminOrdersRoutes.post("/:id/payment-status", requireErpPermission("orders.update_payment_status"), updateOrderPaymentStatusController);
