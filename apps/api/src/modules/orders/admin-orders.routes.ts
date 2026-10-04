import { Router } from "express";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymobCallbackInbox, paymentAttempts } from "@capella/database/drizzle/schema";
import { and, asc, eq, or } from "drizzle-orm";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import { requeuePaymobCallback } from "../payments/paymob/paymob-callback.repository.js";
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
  // A callback parked in review_required is a money problem that never produced a reconciliation_required attempt, so the attempt query above cannot see it; expose the parked receipt too, with only safe fields — never the normalized payload or the raw body.
  const parked = await db.select({
    callbackId: paymobCallbackInbox.id,
    receivedAt: paymobCallbackInbox.receivedAt,
    checkoutId: checkoutSessions.publicId,
    customerName: checkoutSessions.fullName,
    customerEmail: checkoutSessions.email,
    amountCents: checkoutSessions.amountCents,
    currency: checkoutSessions.currency,
    environment: paymentAttempts.environment,
    paymobOrderId: paymobCallbackInbox.signedOrderId,
    paymobTransactionId: paymentAttempts.paymobTransactionId,
    reason: paymobCallbackInbox.lastError
  }).from(paymobCallbackInbox)
    .leftJoin(checkoutSessions, eq(checkoutSessions.id, paymobCallbackInbox.boundSessionId))
    .leftJoin(paymentAttempts, eq(paymentAttempts.paymobOrderId, paymobCallbackInbox.signedOrderId))
    .where(eq(paymobCallbackInbox.processingStatus, "review_required"))
    .orderBy(asc(paymobCallbackInbox.receivedAt), asc(paymobCallbackInbox.id));
  const now = Date.now();
  res.json({ items: rows,
    callbackProblems: parked.map(({ receivedAt, ...row }) => ({ ...row, ageMs: now - receivedAt.getTime() })) });
}));
adminOrdersRoutes.post("/reconciliation/callbacks/:id/requeue", requireErpPermission("orders.update_payment_status"),
  wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "Invalid callback id" });
      return;
    }
    const outcome = await requeuePaymobCallback(id, new Date());
    if (outcome === "missing") {
      res.status(404).json({ message: "Callback not found" });
      return;
    }
    if (outcome === "not_parked") {
      res.status(409).json({ message: "Only a parked callback can be requeued" });
      return;
    }
    res.json({ ok: true });
  }));
adminOrdersRoutes.get("/:id", requireErpPermission("orders.read"), wrapAsync(getAdminOrderController));
adminOrdersRoutes.post("/:id/payment-status", requireErpPermission("orders.update_payment_status"), wrapAsync(updateOrderPaymentStatusController));
