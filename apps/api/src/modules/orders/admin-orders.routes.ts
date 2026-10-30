import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import {
  getAdminOrderController,
  getAdminOrderPaymentSummaryController,
  listAdminOrdersController,
  updateOrderPaymentStatusController
} from "./orders.controller.js";

export const adminOrdersRoutes = Router();
adminOrdersRoutes.get("/", requireErpPermission("orders.read"), wrapAsync(listAdminOrdersController));
adminOrdersRoutes.get("/payment-summary", requireErpPermission("orders.read"), wrapAsync(getAdminOrderPaymentSummaryController));
adminOrdersRoutes.get("/:id", requireErpPermission("orders.read"), wrapAsync(getAdminOrderController));
adminOrdersRoutes.post("/:id/payment-status", requireErpPermission("orders.update_payment_status"), wrapAsync(updateOrderPaymentStatusController));
