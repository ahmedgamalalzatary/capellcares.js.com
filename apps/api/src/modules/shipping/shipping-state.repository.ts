import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { adminUsers, adminUserPermissions, permissions, orders, orderStateHistory, shipments, shippingWorkItems, orderReviewFlags } from "@capella/database/drizzle/schema";
import { shipmentManualStateRequestSchema, shipmentEditSchema, checkoutShippingQuoteSchema } from "@capella/shared";
import { resolveBostaEditRuntime } from "./bosta/bosta-edit.service.js";
import type { AdminOrderShippingStateDto } from "@capella/shared";
import { flagShippingOrder, type ShippingTransaction } from "./shipping-dispatch.repository.js";
import type { BostaObservation } from "./bosta/bosta-sync.service.js";
import { cancellationRefundDue } from "./shipping-cancellation.repository.js";
import { pickWorkItem } from "./shipping-overview.repository.js";
import { ShippingRuleError } from "./shipping-rule-error.js";

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
  if (!Number.isSafeInteger(atMs) || atMs <= 0) throw new ShippingRuleError("Invalid state event time");
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    if (!order?.shippingSnapshot) throw new ShippingRuleError("Shipping order not found");
    if (order.paymentStatus === "denied" || order.cancellationStatus !== null) throw new ShippingRuleError("Denied/cancelling orders are locked");
    const [actor] = await tx.select().from(adminUsers).where(eq(adminUsers.id, actorId)).limit(1);
    const grants = actor?.role === "staff" ? await tx.select({ key: permissions.key }).from(adminUserPermissions)
      .innerJoin(permissions, eq(permissions.id, adminUserPermissions.permissionId))
      .where(eq(adminUserPermissions.adminUserId, actorId)) : [];
    if (!actor?.isActive || (actor.role !== "admin" && !["orders.read", "shipping.read", "shipping.update_state"].every(key => grants.some(grant => grant.key === key)))) {
      throw new ShippingRuleError("Shipping state permission required; actor is not authorized");
    }
    if (order.manualShippingState === body.state) return false;
    const [ship] = await tx.select().from(shipments).where(and(eq(shipments.orderId, orderId), eq(shipments.kind, "outgoing"))).limit(1).for("update");
    const processing = ["preparing", "ready_for_pickup", "printed"].includes(body.state);
    await tx.update(orders).set({ manualShippingState: body.state,
      shippingProcessingAtMs: processing ? first(order.shippingProcessingAtMs, atMs) : order.shippingProcessingAtMs }).where(eq(orders.id, orderId));
    if (ship) await tx.update(shipments).set({ manualState: body.state }).where(eq(shipments.id, ship.id));
    await tx.insert(orderStateHistory).values({ orderId, state: body.state, actorType: "staff", actorId, eventAtMs: atMs, reason: body.reason ?? null });
    if (body.state === "delivered" || (body.state === "printed" && !ship)) {
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
  if (!order?.shippingSnapshot) throw new ShippingRuleError("Shipping order not found");
  if (order.paymentStatus === "denied" || order.cancellationStatus !== null || order.refundedAmountCents > 0 ||
    (order.paymentMethod === "paymob" && order.providerPaymentStatus !== "succeeded")) throw new ShippingRuleError("Denied/refunded/unpaid orders are locked");
  if (order.shippingPickupAtMs !== null || ["delivered", "returned"].includes(order.manualShippingState ?? "")) throw new ShippingRuleError("Shipping edits are locked after pickup or reported delivery/return");
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
      throw new ShippingRuleError("Fresh verified carrier pre-pickup edit availability is required");
    }
  } else {
    const jobs = await tx.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.orderId, orderId), eq(shippingWorkItems.operation, "create_delivery"))).for("update");
    if (jobs.some(job => job.responseSnapshot !== null || ["processing", "review_required", "succeeded"].includes(job.status) ||
      (job.requestSnapshot !== null && !(job.status === "failed" && job.lastError === "CREATE_REJECTED")))) {
      throw new ShippingRuleError("Frozen or uncertain delivery creation blocks edits until linked/reconciled");
    }
  }
  return patch;
}

export async function getOrderShippingState(input: Pick<Order, "id" | "shippingSnapshot">): Promise<AdminOrderShippingStateDto | null> {
  if (!input.shippingSnapshot) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
  if (!order) return null;
  const parcels = await db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(asc(shipments.id));
  const ship = parcels.find(parcel => parcel.kind === "outgoing");
  const history = await db.select().from(orderStateHistory).where(eq(orderStateHistory.orderId, order.id)).orderBy(asc(orderStateHistory.id));
  const flags = await db.select({ id: orderReviewFlags.id, flagType: orderReviewFlags.flagType, reason: orderReviewFlags.reason })
    .from(orderReviewFlags).where(and(eq(orderReviewFlags.orderId, order.id), eq(orderReviewFlags.status, "open")));
  const jobs = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, order.id)).orderBy(desc(shippingWorkItems.id));
  const outgoingJobs = jobs.filter(job => job.shipmentId === null || job.shipmentId === ship?.id);
  const work = pickWorkItem(outgoingJobs);
  const quote = checkoutShippingQuoteSchema.parse(JSON.parse(order.shippingSnapshot!));
  let editEnabled = !ship;
  if (ship) {
    try { editEnabled = resolveBostaEditRuntime() !== null; }
    catch { /* Invalid edit configuration must not block order-detail reads. */ }
  }
  return { flags, destination: { cityId: quote.address.cityId, zoneId: quote.address.zoneId, districtId: quote.address.districtId },
    relatedShipments: parcels.filter(parcel => parcel.kind !== "outgoing").map(parcel => {
      const work = pickWorkItem(jobs.filter(job => job.shipmentId === parcel.id));
      return { id: parcel.id, kind: parcel.kind === "return" ? "return" : "exchange", trackingNumber: parcel.trackingNumber,
        manualState: parcel.manualState, carrierState: parcel.normalizedState, rawProviderState: parcel.rawProviderState,
        rawProviderCode: parcel.rawProviderCode, rawProviderType: parcel.rawProviderType, custodyState: parcel.custodyState,
        providerEventAtMs: parcel.providerEventAtMs,
        workItem: work ? { operation: work.operation, status: work.status, lastError: work.lastError } : null };
    }),
    editEnabled, hasPendingEdit: outgoingJobs.some(job => job.operation === "edit_delivery" && ["processing", "review_required"].includes(job.status)),
    packingSize: ship?.size ?? order.shippingSize,
    carrierSnapshot: ship?.carrierSnapshot ? JSON.parse(ship.carrierSnapshot) : null,
    workItem: work ? { operation: work.operation, status: work.status, lastError: work.lastError } : null,
    manualState: order.manualShippingState ?? ship?.manualState ?? null, carrierState: ship?.normalizedState ?? null,
    rawProviderCode: ship?.rawProviderCode ?? null, rawProviderType: ship?.rawProviderType ?? null,
    custodyState: ship?.custodyState ?? "unknown", collection: { confirmed: ship?.collectionConfirmed ?? false, amountCents: ship?.collectedAmountCents ?? null },
    cancellation: order.cancellationStatus ? { status: order.cancellationStatus, requestedAtMs: order.cancellationRequestedAtMs,
      completedAtMs: order.cancellationCompletedAtMs, stockRestoredAtMs: order.stockRestoredAtMs, refundRequiredCents: cancellationRefundDue(order) } : null,
    processing: { startedAtMs: order.shippingProcessingAtMs, pickupAtMs: order.shippingPickupAtMs,
      addressBlockedAtMs: order.shippingAddressBlockedAtMs, untouchedExpiryApplies: untouchedShippingExpiryApplies(order) },
    history: history.map(row => ({ id: row.id, state: row.state, actorType: row.actorType, actorId: row.actorId,
      atMs: row.eventAtMs ?? row.createdAt.getTime(), reason: row.reason })) };
}
