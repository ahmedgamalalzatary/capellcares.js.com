import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@capella/database/src/db";
import { adminUsers, adminUserPermissions, permissions, orders, orderItems, orderStateHistory, shipments, shippingWorkItems, productVariants, orderReviewFlags } from "@capella/database/drizzle/schema";
import { flagShippingOrder, stopUnsentDelivery, type ShippingTransaction } from "./shipping-dispatch.repository.js";
import { untouchedShippingExpiryApplies } from "./shipping-state.repository.js";

type Order = typeof orders.$inferSelect;
export type CancellationSource = "staff" | "customer" | "expiry" | "refund";
const requestSchema = z.object({ source: z.enum(["staff", "customer"]), actorId: z.number().int().positive().max(2_147_483_647),
  reason: z.string().trim().min(1).max(1000).optional() }).strict();
const componentsSchema = z.array(z.object({ variantId: z.number().int().positive(), qty: z.number().int().positive() })).min(1);
export class ShippingCancellationError extends Error {}
function carrierCancellationBarrierRecorded(snapshot: string | null) {
  if (snapshot === null) return false;
  try { const saved = JSON.parse(snapshot); return typeof saved?.printingObservedAtMs === "number" || saved?.collectionObservedCents > 0; }
  catch { return true; }
}
export const cancellationRefundDue = (order: Pick<Order, "paymentMethod" | "totalAmount" | "refundedAmountCents" | "cancellationStatus">) =>
  order.paymentMethod === "paymob" && order.cancellationStatus === "cancelled" ? Math.max(0, Math.round(Number(order.totalAmount) * 100) - order.refundedAmountCents) : 0;

/** Caller holds the order lock. Manual historical printing cannot be erased by another state. */
export async function directCancellationBlocked(tx: ShippingTransaction, order: Order) {
  if (order.shippingPickupAtMs !== null || ["printed", "delivered", "returned"].includes(order.manualShippingState ?? "")) return true;
  const [history] = await tx.select({ id: orderStateHistory.id }).from(orderStateHistory).where(and(eq(orderStateHistory.orderId, order.id),
    inArray(orderStateHistory.state, ["printed", "delivered", "returned"]))).limit(1);
  const [ship] = await tx.select().from(shipments).where(and(eq(shipments.orderId, order.id), eq(shipments.kind, "outgoing"))).limit(1);
  const [cancellation] = await tx.select({ responseSnapshot: shippingWorkItems.responseSnapshot }).from(shippingWorkItems)
    .where(eq(shippingWorkItems.idempotencyKey, `bosta_cancel_order_${order.id}`)).limit(1);
  return !!history || carrierCancellationBarrierRecorded(cancellation?.responseSnapshot ?? null) || !!ship && (["picked_up", "in_transit", "delivered", "returned"].includes(ship.normalizedState) || ship.collectionConfirmed || (ship.collectedAmountCents ?? 0) > 0 ||
    ship.custodyState !== "unknown" || ["printed", "delivered", "returned"].includes(ship.manualState ?? ""));
}

/** Internal finalization only, after the worker proves carrier cancellation and warehouse custody or an unsent intent is stopped. */
export async function finishShippingCancellation(tx: ShippingTransaction, order: Order, now: Date) {
  if (order.cancellationStatus === "cancelled") return;
  if (order.stockRestoredAtMs === null) {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    if (!items.length) throw new Error("Cancellation sold-item snapshot is missing");
    for (const item of items) {
      if (!Number.isSafeInteger(item.qty) || item.qty < 1) throw new Error("Cancellation quantity snapshot is invalid");
      const components = item.itemType === "product_variant"
        ? componentsSchema.parse([{ variantId: item.variantId, qty: 1 }])
        : componentsSchema.parse(JSON.parse(item.snapshotComponents ?? "null"));
      for (const component of components) {
        const qty = component.qty * item.qty;
        if (!Number.isSafeInteger(qty) || qty > 2_147_483_647) throw new Error("Cancellation component quantity is invalid");
        const result = await tx.update(productVariants).set({ stockQty: sql`${productVariants.stockQty} + ${qty}` }).where(eq(productVariants.id, component.variantId));
        if (result[0].affectedRows !== 1) throw new Error("Cancellation sold variant is missing");
      }
    }
  }
  const updated = { ...order, cancellationStatus: "cancelled" as const };
  const refundRequiredCents = cancellationRefundDue(updated);
  await tx.update(orders).set({ cancellationStatus: "cancelled", cancellationCompletedAtMs: now.getTime(),
    stockRestoredAtMs: order.stockRestoredAtMs ?? now.getTime(),
    paymentStatus: order.paymentMethod === "cod" || refundRequiredCents === 0 ? "denied" : order.paymentStatus }).where(eq(orders.id, order.id));
  await tx.update(shippingWorkItems).set({ status: "succeeded", lastError: null, claimedBy: null, claimedAt: null })
    .where(and(eq(shippingWorkItems.orderId, order.id), eq(shippingWorkItems.operation, "cancel_delivery")));
  await tx.update(orderReviewFlags).set({ status: "resolved", resolvedAt: now }).where(and(eq(orderReviewFlags.orderId, order.id),
    eq(orderReviewFlags.flagType, "cancellation_pending"), eq(orderReviewFlags.status, "open")));
  if (refundRequiredCents > 0) await flagShippingOrder(tx, order.id, "refund_review", "Order safely cancelled and stock restored; issue the full products-plus-shipping refund manually in Paymob and await its verified callback");
  else if (order.paymentMethod === "paymob" && order.providerPaymentStatus === "refunded") await tx.update(orderReviewFlags).set({ status: "resolved", resolvedAt: now })
    .where(and(eq(orderReviewFlags.orderId, order.id), eq(orderReviewFlags.flagType, "refund_review"), eq(orderReviewFlags.status, "open")));
}

/** Shared trusted integration point for rejection, expiry and verified refund callbacks. Caller already holds the order lock. */
export async function requestShippingCancellationInTransaction(tx: ShippingTransaction, order: Order, source: CancellationSource,
  options: { actorId?: number; reason?: string; now?: Date; requireUnsent?: boolean } = {}) {
  const now = options.now ?? new Date();
  if (!order.shippingSnapshot) throw new ShippingCancellationError("Shipping order not found");
  if (order.cancellationStatus === "cancelled") {
    if (source === "refund" && order.providerPaymentStatus === "refunded" && cancellationRefundDue(order) === 0) {
      await tx.update(orders).set({ paymentStatus: "denied" }).where(eq(orders.id, order.id));
      await tx.update(orderReviewFlags).set({ status: "resolved", resolvedAt: now }).where(and(eq(orderReviewFlags.orderId, order.id),
        eq(orderReviewFlags.flagType, "refund_review"), eq(orderReviewFlags.status, "open")));
    }
    return { status: "cancelled" as const, refundRequiredCents: cancellationRefundDue(order) };
  }
  if (source === "expiry" && (order.paymentMethod !== "cod" || order.paymentStatus !== "pending" || !order.codExpiresAt ||
    order.codExpiresAt > now || !untouchedShippingExpiryApplies(order))) return null;
  const [edit] = await tx.select({ id: shippingWorkItems.id }).from(shippingWorkItems).where(and(eq(shippingWorkItems.orderId, order.id),
    eq(shippingWorkItems.operation, "edit_delivery"), inArray(shippingWorkItems.status, ["processing", "review_required"]))).limit(1).for("update");
  if (edit && (source === "staff" || source === "customer")) throw new ShippingCancellationError("Shipment edit is pending; confirm its outcome before cancellation");
  const blocked = await directCancellationBlocked(tx, order);
  if (blocked && (source === "customer" || source === "staff")) throw new ShippingCancellationError("Direct cancellation is locked after printing or pickup; verify custody with staff");
  if (order.paymentStatus === "denied" && !order.cancellationStatus) throw new ShippingCancellationError("Denied orders are locked");
  if (order.refundedAmountCents > 0 && order.refundedAmountCents !== Math.round(Number(order.totalAmount) * 100) && source !== "refund") {
    throw new ShippingCancellationError("Partial refund requires staff review");
  }
  const safe = !blocked && await stopUnsentDelivery(tx, order.id);
  if (options.requireUnsent && !safe) throw new ShippingCancellationError("Check shipping cancellation and warehouse custody before rejecting this order");
  const [existing] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.idempotencyKey, `bosta_cancel_order_${order.id}`)).limit(1).for("update");
  if (!existing) await tx.insert(shippingWorkItems).values({ orderId: order.id, operation: "cancel_delivery", idempotencyKey: `bosta_cancel_order_${order.id}`,
    status: "pending", nextAttemptAt: new Date(Math.floor(now.getTime() / 1000) * 1000), requestSnapshot: JSON.stringify({ source, actorId: options.actorId ?? null, reason: options.reason ?? null }) });
  const requested = { ...order, cancellationStatus: "pending" as const, cancellationRequestedAtMs: order.cancellationRequestedAtMs ?? now.getTime() };
  await tx.update(orders).set({ cancellationStatus: "pending", cancellationRequestedAtMs: requested.cancellationRequestedAtMs }).where(eq(orders.id, order.id));
  if (safe) {
    await finishShippingCancellation(tx, requested, now);
    return { status: "cancelled" as const, refundRequiredCents: cancellationRefundDue({ ...requested, cancellationStatus: "cancelled" }) };
  }
  await flagShippingOrder(tx, order.id, source === "expiry" ? "expiry_review" : "cancellation_pending",
    "Cancellation pending; new dispatch blocked and stock retained until verified cancellation and safe warehouse custody");
  return { status: "pending" as const, refundRequiredCents: 0 };
}

/** Internal S13/S15 action service; no new public route or permission catalog in S10. */
export async function requestShippingCancellation(orderId: number, input: unknown) {
  const body = requestSchema.parse(input);
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order?.shippingSnapshot || (body.source === "customer" && (order.customerType !== "registered" || order.customerId !== body.actorId))) {
      throw new ShippingCancellationError("Shipping order not found");
    }
    if (body.source === "staff") {
      const [actor] = await tx.select().from(adminUsers).where(eq(adminUsers.id, body.actorId)).limit(1);
      const grants = actor?.role === "staff" ? await tx.select({ key: permissions.key }).from(adminUserPermissions)
        .innerJoin(permissions, eq(permissions.id, adminUserPermissions.permissionId)).where(eq(adminUserPermissions.adminUserId, body.actorId)) : [];
      if (!actor?.isActive || (actor.role !== "admin" && !["orders.read", "shipping.read", "shipping.update_state"].every(key => grants.some(grant => grant.key === key)))) {
        throw new ShippingCancellationError("Shipping cancellation permission required");
      }
    }
    return (await requestShippingCancellationInTransaction(tx, order, body.source, { actorId: body.actorId, reason: body.reason }))!;
  });
}
