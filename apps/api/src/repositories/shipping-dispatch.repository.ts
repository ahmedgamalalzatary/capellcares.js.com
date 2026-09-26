import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@capella/database/src/db";
import { orders, shippingWorkItems, shipments, orderReviewFlags, orderStateHistory } from "@capella/database/drizzle/schema";

export type ShippingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Call inside the order transaction. Never scan or import historical orders. */
export async function enqueueOrderDelivery(tx: ShippingTransaction, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
  if (!order?.shippingSnapshot) return;
  const [existing] = await tx.select({ id: shippingWorkItems.id }).from(shippingWorkItems).where(and(
    eq(shippingWorkItems.orderId, orderId), eq(shippingWorkItems.operation, "create_delivery"))).limit(1);
  if (existing) return;
  const blocked = order.paymentStatus === "denied" || order.refundedAmountCents > 0;
  await tx.insert(shippingWorkItems).values({ orderId, operation: "create_delivery",
    idempotencyKey: `bosta_create_${orderId}_${randomUUID()}`, status: blocked ? "failed" : "pending",
    lastError: blocked ? "ORDER_NOT_DISPATCHABLE" : null, nextAttemptAt: new Date() });
  if (order.refundedAmountCents > 0) await flagShippingOrder(tx, orderId, "refund_review",
    "Refund received before order creation; delivery blocked pending staff review");
}

export async function flagShippingOrder(tx: ShippingTransaction, orderId: number,
  flagType: typeof orderReviewFlags.$inferInsert.flagType, reason: string) {
  const [existing] = await tx.select({ id: orderReviewFlags.id }).from(orderReviewFlags).where(and(
    eq(orderReviewFlags.orderId, orderId), eq(orderReviewFlags.flagType, flagType), eq(orderReviewFlags.status, "open"))).limit(1);
  if (!existing) await tx.insert(orderReviewFlags).values({ orderId, flagType, reason });
}

/** Caller holds the order row lock, shared by claims, refund callbacks and rejection. */
export async function stopUnsentDelivery(tx: ShippingTransaction, orderId: number): Promise<boolean> {
  const [order] = await tx.select({ manualState: orders.manualShippingState, pickupAtMs: orders.shippingPickupAtMs })
    .from(orders).where(eq(orders.id, orderId)).limit(1);
  if (order && (order.pickupAtMs !== null || ["printed", "delivered", "returned"].includes(order.manualState ?? ""))) return false;
  const [custodyHistory] = await tx.select({ id: orderStateHistory.id }).from(orderStateHistory).where(and(
    eq(orderStateHistory.orderId, orderId), inArray(orderStateHistory.state, ["printed", "delivered", "returned"]))).limit(1);
  if (custodyHistory) return false;
  const jobs = await tx.select().from(shippingWorkItems).where(and(
    eq(shippingWorkItems.orderId, orderId), eq(shippingWorkItems.operation, "create_delivery"))).for("update");
  const linked = await tx.select({ id: shipments.id }).from(shipments).where(eq(shipments.orderId, orderId)).limit(1);
  if (linked.length || jobs.some(job => ["processing", "succeeded", "review_required"].includes(job.status))) return false;
  for (const job of jobs) await tx.update(shippingWorkItems).set({ status: "failed", lastError: "ORDER_NOT_DISPATCHABLE" })
    .where(eq(shippingWorkItems.id, job.id));
  return true;
}

export async function blockRefundedDelivery(tx: ShippingTransaction, orderId: number) {
  const safe = await stopUnsentDelivery(tx, orderId);
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.shippingSnapshot) return;
  const cancellation = !safe && order.refundedAmountCents === Math.round(Number(order.totalAmount) * 100);
  await flagShippingOrder(tx, orderId, cancellation ? "cancellation_pending" : "refund_review",
    cancellation ? "Full refund recorded; carrier outcome/custody must be checked before cancellation or restocking"
      : safe ? "Refund recorded; unsent delivery stopped" : "Partial refund recorded; dispatch blocked pending staff review");
}
