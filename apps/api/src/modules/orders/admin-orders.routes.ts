import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import {
  getAdminOrderController,
  listAdminOrdersController,
  updateOrderPaymentStatusController
} from "./orders.controller.js";

export const adminOrdersRoutes = Router();
adminOrdersRoutes.get("/", requireErpPermission("orders.read"), wrapAsync(listAdminOrdersController));
adminOrdersRoutes.get("/:id", requireErpPermission("orders.read"), wrapAsync(getAdminOrderController));
adminOrdersRoutes.post("/:id/payment-status", requireErpPermission("orders.update_payment_status"), wrapAsync(updateOrderPaymentStatusController));
