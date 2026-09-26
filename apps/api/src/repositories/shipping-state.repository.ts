import { and, asc, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { adminUsers, adminUserPermissions, permissions, orders, orderStateHistory, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { shipmentManualStateRequestSchema, shipmentEditSchema } from "@capella/shared";
import type { AdminOrderShippingStateDto } from "@capella/shared";
import { flagShippingOrder, type ShippingTransaction } from "./shipping-dispatch.repository.js";
import type { BostaObservation } from "../modules/shipping/bosta/bosta-sync.service.js";

type Order = typeof orders.$inferSelect;
type Shipment = typeof shipments.$inferSelect;
const first = (old: number | null, next: number) => old === null ? next : Math.min(old, next);
export const shippingAddressException = (event: BostaObservation) => event.stateCode === 47 && [5, 12, 13, 14].includes(event.exceptionCode ?? -1);
export const untouchedShippingExpiryApplies = (order: Pick<Order, "shippingPickupAtMs" | "shippingProcessingAtMs" | "shippingAddressBlockedAtMs">) =>
  order.shippingPickupAtMs === null && (order.shippingProcessingAtMs === null || order.shippingAddressBlockedAtMs !== null);

/** Internal operation for S13's authorized action service; no public mutation route in S09. */
export async function recordOrderManualState(orderId: number, input: unknown, actorId: number, options: { now?: Date } = {}) {
  const body = shipmentManualStateRequestSchema.parse(input);
  const atMs = (options.now ?? new Date()).getTime();
  if (!Number.isSafeInteger(atMs) || atMs <= 0) throw new Error("Invalid state event time");
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order?.shippingSnapshot) throw new Error("Shipping order not found");
    if (order.paymentStatus === "denied") throw new Error("Denied orders are locked");
    const [actor] = await tx.select().from(adminUsers).where(eq(adminUsers.id, actorId)).limit(1);
    const grants = actor?.role === "staff" ? await tx.select({ key: permissions.key }).from(adminUserPermissions)
      .innerJoin(permissions, eq(permissions.id, adminUserPermissions.permissionId))
      .where(eq(adminUserPermissions.adminUserId, actorId)) : [];
    if (!actor?.isActive || (actor.role !== "admin" && !["orders.read", "shipping.read", "shipping.update_state"].every(key => grants.some(grant => grant.key === key)))) {
      throw new Error("Shipping state permission required; actor is not authorized");
    }
    if (order.manualShippingState === body.state) return false;
    const [ship] = await tx.select().from(shipments).where(and(eq(shipments.orderId, orderId), eq(shipments.kind, "outgoing"))).limit(1).for("update");
    const processing = ["preparing", "ready_for_pickup", "printed"].includes(body.state);
    await tx.update(orders).set({ manualShippingState: body.state,
      shippingProcessingAtMs: processing ? first(order.shippingProcessingAtMs, atMs) : order.shippingProcessingAtMs }).where(eq(orders.id, orderId));
    if (ship) await tx.update(shipments).set({ manualState: body.state }).where(eq(shipments.id, ship.id));
    await tx.insert(orderStateHistory).values({ orderId, state: body.state, actorType: "staff", actorId, eventAtMs: atMs, reason: body.reason ?? null });
    if (["delivered", "returned"].includes(body.state) || (body.state === "printed" && !ship)) {
      await flagShippingOrder(tx, orderId, "custody_review", "Staff shipping report is independent of carrier/payment evidence; verify custody before rejection or restocking");
    }
    return true;
  });
}

/** Caller holds the order/shipment locks. Historical pickup evidence must survive late events. */
export async function recordCarrierShippingFacts(tx: ShippingTransaction, order: Order, ship: Shipment, event: BostaObservation,
  current: boolean, confirmed = event.confirmedDelivery === true) {
  const outgoingType = ["SEND", "FXF_SEND"].includes(event.type);
  const returnedType = ["RTO", "EXCHANGE", "CUSTOMER_RETURN_PICKUP"].includes(event.type);
  const physicalProgress = [21, 23, 24, 30, 41].includes(event.stateCode) || (outgoingType && event.stateCode === 45 && confirmed)
    || (returnedType && event.stateCode === 46);
  if (ship.kind === "outgoing") {
    const pickupAtMs = physicalProgress ? first(order.shippingPickupAtMs, event.atMs) : order.shippingPickupAtMs;
    await tx.update(orders).set({ shippingPickupAtMs: pickupAtMs,
      shippingProcessingAtMs: physicalProgress ? first(order.shippingProcessingAtMs, event.atMs) : order.shippingProcessingAtMs,
      shippingAddressBlockedAtMs: pickupAtMs !== null ? null : current
        ? shippingAddressException(event) ? event.atMs : null : order.shippingAddressBlockedAtMs }).where(eq(orders.id, order.id));
  }
  if (!current) return;
  const custodyState: Shipment["custodyState"] = [21, 23, 24, 30, 41].includes(event.stateCode) ? "carrier"
    : event.stateCode === 45 && ["SEND", "FXF_SEND"].includes(event.type) && confirmed ? "recipient"
    : event.stateCode === 46 && ["RTO", "EXCHANGE", "CUSTOMER_RETURN_PICKUP"].includes(event.type) ? "warehouse_uninspected" : "unknown";
  await tx.update(shipments).set({ rawProviderType: event.type, custodyState }).where(eq(shipments.id, ship.id));
}

export type ShippingEditEvidence = { verified: true; editable: true; prePickup: true; trackingNumber: string; stateCode: number; eventAtMs: number;
  accountId: string; environment: string; businessReference: string };
/** Use inside the mutation transaction; evidence must come from a verified server-side carrier read, never the request body. */
export async function assertShippingEditAllowed(tx: ShippingTransaction, orderId: number, input: unknown, evidence?: ShippingEditEvidence) {
  const patch = shipmentEditSchema.parse(input);
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
  if (!order?.shippingSnapshot) throw new Error("Shipping order not found");
  if (order.paymentStatus === "denied" || order.refundedAmountCents > 0 ||
    (order.paymentMethod === "paymob" && order.providerPaymentStatus !== "succeeded")) throw new Error("Denied/refunded/unpaid orders are locked");
  if (order.shippingPickupAtMs !== null || ["delivered", "returned"].includes(order.manualShippingState ?? "")) throw new Error("Shipping edits are locked after pickup or reported delivery/return");
  const [ship] = await tx.select().from(shipments).where(and(eq(shipments.orderId, orderId), eq(shipments.kind, "outgoing"))).limit(1).for("update");
  if (ship) {
    const [intent] = await tx.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "create_delivery"),
      eq(shippingWorkItems.idempotencyKey, ship.idempotencyKey))).limit(1).for("update");
    let accountMatches = false;
    try {
      const frozen = JSON.parse(intent?.requestSnapshot ?? "null");
      accountMatches = intent?.orderId === orderId && frozen?.accountId === evidence?.accountId && frozen?.environment === evidence?.environment &&
        frozen?.payload?.businessReference === evidence?.businessReference && evidence?.businessReference === ship.idempotencyKey;
    } catch { /* Corrupt/missing account evidence never authorizes an edit. */ }
    if (evidence?.verified !== true || evidence.editable !== true || evidence.prePickup !== true || evidence.trackingNumber !== ship.trackingNumber ||
      !accountMatches || evidence.stateCode !== ship.rawProviderCode || evidence.eventAtMs !== ship.providerEventAtMs || ![10, 11, 20, 22, 47].includes(ship.rawProviderCode ?? -1)) {
      throw new Error("Fresh verified carrier pre-pickup edit availability is required");
    }
  } else {
    const jobs = await tx.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.orderId, orderId), eq(shippingWorkItems.operation, "create_delivery"))).for("update");
    if (jobs.some(job => job.requestSnapshot !== null || job.responseSnapshot !== null || ["processing", "review_required", "succeeded"].includes(job.status))) {
      throw new Error("Frozen or uncertain delivery creation blocks edits until linked/reconciled");
    }
  }
  return patch;
}

export async function getOrderShippingState(input: Pick<Order, "id" | "shippingSnapshot">): Promise<AdminOrderShippingStateDto | null> {
  if (!input.shippingSnapshot) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
  if (!order) return null;
  const [ship] = await db.select().from(shipments).where(and(eq(shipments.orderId, order.id), eq(shipments.kind, "outgoing"))).limit(1);
  const history = await db.select().from(orderStateHistory).where(eq(orderStateHistory.orderId, order.id)).orderBy(asc(orderStateHistory.id));
  return { manualState: order.manualShippingState ?? ship?.manualState ?? null, carrierState: ship?.normalizedState ?? null,
    rawProviderCode: ship?.rawProviderCode ?? null, rawProviderType: ship?.rawProviderType ?? null,
    custodyState: ship?.custodyState ?? "unknown", collection: { confirmed: ship?.collectionConfirmed ?? false, amountCents: ship?.collectedAmountCents ?? null },
    processing: { startedAtMs: order.shippingProcessingAtMs, pickupAtMs: order.shippingPickupAtMs,
      addressBlockedAtMs: order.shippingAddressBlockedAtMs, untouchedExpiryApplies: untouchedShippingExpiryApplies(order) },
    history: history.map(row => ({ id: row.id, state: row.state, actorType: row.actorType, actorId: row.actorId,
      atMs: row.eventAtMs ?? row.createdAt.getTime(), reason: row.reason })) };
}
