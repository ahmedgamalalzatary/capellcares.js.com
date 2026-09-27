import { Router } from "express";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymentAttempts } from "@capella/database/drizzle/schema";
import { and, eq, or } from "drizzle-orm";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import {
  getAdminOrderController,
  listAdminOrderReviewFlagsController,
  listAdminOrdersController,
  resolveAdminOrderReviewFlagController,
  updateOrderPaymentStatusController
} from "./orders.controller.js";

export const adminOrdersRoutes = Router();
adminOrdersRoutes.get("/", requireErpPermission("orders.read"), wrapAsync(listAdminOrdersController));
adminOrdersRoutes.get("/review-flags", requireErpPermission("orders.read"), wrapAsync(listAdminOrderReviewFlagsController));
// Registered before "/:id" so the literal review-flags path is never read as an order id.
adminOrdersRoutes.post("/review-flags/:flagId/resolve", requireErpPermission("orders.read"), wrapAsync(resolveAdminOrderReviewFlagController));
adminOrdersRoutes.get("/reconciliation", requireErpPermission("orders.read"), wrapAsync(async (_req, res) => {
  const rows = await db.select({
    checkoutId: checkoutSessions.publicId,
    customerName: checkoutSessions.fullName,
    customerEmail: checkoutSessions.email,
    amountCents: paymentAttempts.amountCents,
    currency: paymentAttempts.currency,
    environment: paymentAttempts.environment,
    paymobOrderId: paymentAttempts.paymobOrderId,
    paymobTransactionId: paymentAttempts.paymobTransactionId,
    reason: paymentAttempts.failureCode
  }).from(paymentAttempts)
    .innerJoin(checkoutSessions, eq(checkoutSessions.id, paymentAttempts.checkoutSessionId))
    .where(or(
      eq(paymentAttempts.status, "reconciliation_required"),
      and(eq(paymentAttempts.status, "succeeded"),
        eq(paymentAttempts.failureCode, "SECOND_CAPTURE_AFTER_SUCCESS"))
    ));
  res.json({ items: rows });
}));
adminOrdersRoutes.get("/:id", requireErpPermission("orders.read"), wrapAsync(getAdminOrderController));
adminOrdersRoutes.post("/:id/payment-status", requireErpPermission("orders.update_payment_status"), wrapAsync(updateOrderPaymentStatusController));
