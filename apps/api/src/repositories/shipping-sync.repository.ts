import { createHash } from "node:crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shipmentEvents, shippingWorkItems } from "@capella/database/drizzle/schema";
import { flagShippingOrder, type ShippingTransaction } from "./shipping-dispatch.repository.js";
import { normalizeBostaState, type BostaObservation, type BostaSyncRuntime } from "../modules/shipping/bosta/bosta-sync.service.js";
import { recordCarrierShippingFacts, shippingAddressException } from "./shipping-state.repository.js";

type Shipment = typeof shipments.$inferSelect;
type Order = typeof orders.$inferSelect;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
export function shippingEventFingerprint(runtime: BostaSyncRuntime, event: BostaObservation): string {
  const { raw: _raw, ...semantic } = event;
  return createHash("sha256").update(JSON.stringify([runtime.accountKey, canonical(semantic)])).digest("hex");
}
export function shippingRequestMatchesAccount(snapshot: string | null, reference: string, runtime: BostaSyncRuntime): boolean {
  try {
    const request = JSON.parse(snapshot ?? "null");
    return request?.accountId === runtime.accountId && request.environment === runtime.environment &&
      request.payload?.businessReference === reference;
  } catch { return false; }
}
async function binding(tx: ShippingTransaction, reference: string, runtime: BostaSyncRuntime) {
  const [job] = await tx.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "create_delivery"),
    eq(shippingWorkItems.idempotencyKey, reference))).limit(1);
  return job && shippingRequestMatchesAccount(job.requestSnapshot, reference, runtime) ? job : null;
}
async function apply(tx: ShippingTransaction, order: Order, ship: Shipment, event: BostaObservation): Promise<string | null> {
  if (ship.providerEventAtMs !== null && event.atMs < ship.providerEventAtMs) {
    await recordCarrierShippingFacts(tx, order, ship, event, false);
    return "STALE_EVENT";
  }
  const normalizedState = normalizeBostaState(event.stateCode, event.type);
  const sameTime = ship.providerEventAtMs === event.atMs;
  if (sameTime && (ship.rawProviderCode !== event.stateCode || ship.normalizedState !== normalizedState ||
    (normalizedState === "delivered" && ship.collectionConfirmed && event.confirmedDelivery === false) ||
    (ship.collectedAmountCents !== null && event.collectedAmountCents !== null && ship.collectedAmountCents !== event.collectedAmountCents))) {
    await flagShippingOrder(tx, order.id, "custody_review", "Conflicting carrier state/collection share one timestamp; reconcile before payment or custody decisions");
    return "CONFLICTING_EVENT";
  }
  const collected = sameTime && event.collectedAmountCents === null ? ship.collectedAmountCents : event.collectedAmountCents;
  const confirmed = sameTime ? ship.collectionConfirmed || event.confirmedDelivery === true : event.confirmedDelivery === true;
  const totalCents = Math.round(Number(order.totalAmount) * 100);
  // A later non-delivery state does not undo the collection that verified COD payment.
  const preserveCollection = ship.kind === "outgoing" && order.paymentMethod === "cod" && order.paymentStatus === "accepted" &&
    ship.collectionConfirmed && ship.collectedAmountCents === totalCents && normalizedState !== "delivered";
  await recordCarrierShippingFacts(tx, order, ship, event, true, confirmed);
  const carrier = { ...(ship.carrierSnapshot ? JSON.parse(ship.carrierSnapshot) : {}), ...event.carrier };
  await tx.update(shipments).set({ rawProviderCode: event.stateCode, rawProviderState: event.stateName,
    normalizedState, providerEventAtMs: event.atMs, collectedAmountCents: preserveCollection ? ship.collectedAmountCents : collected,
    collectionConfirmed: preserveCollection ? ship.collectionConfirmed : confirmed,
    carrierSnapshot: JSON.stringify(carrier) }).where(eq(shipments.id, ship.id));
  if (preserveCollection) await flagShippingOrder(tx, order.id, "custody_review",
    "Carrier state contradicts verified paid COD collection; collection evidence retained, reconcile shipment with staff");
  if (order.paymentStatus === "denied" || order.refundedAmountCents > 0) {
    await flagShippingOrder(tx, order.id, "custody_review", "Carrier update after rejection/refund; verify outcome and custody, retain payment evidence and stock");
    return null;
  }
  if (ship.kind === "outgoing" && order.paymentMethod === "cod") {
    if (event.carrier.requestedCodAmountCents !== undefined && event.carrier.requestedCodAmountCents !== totalCents) {
      await flagShippingOrder(tx, order.id, "amount_mismatch", "Bosta requested collection differs from locked customer total; order total retained");
    }
    if (normalizedState === "delivered" && ["SEND", "FXF_SEND"].includes(event.type)) {
      if (collected !== null && collected !== totalCents) {
        await flagShippingOrder(tx, order.id, "amount_mismatch", "Confirmed delivery collection differs from locked customer total; verify payment with staff");
      } else if (confirmed && collected === totalCents) {
        await tx.update(orders).set({ paymentStatus: "accepted" }).where(eq(orders.id, order.id));
      } else await flagShippingOrder(tx, order.id, "custody_review", "Delivered COD lacks verified confirmation/actual collection evidence; leave unpaid");
    }
  }
  if (normalizedState === "exception" || normalizedState === "returned" || normalizedState === "cancelled") {
    await flagShippingOrder(tx, order.id, shippingAddressException(event) ? "address_review" : "custody_review",
      "Carrier exception/return/cancellation requires staff handling; no stock or refund effects inferred");
  }
  return null;
}

export async function recordShippingObservation(runtime: BostaSyncRuntime, event: BostaObservation): Promise<"processed" | "pending" | "ignored"> {
  const [found] = await db.select().from(shipments).where(eq(shipments.trackingNumber, event.trackingNumber)).limit(1);
  const reference = found?.idempotencyKey ?? event.businessReference;
  if (!reference) return "ignored";
  const [intent] = await db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "create_delivery"),
    eq(shippingWorkItems.idempotencyKey, reference))).limit(1);
  if (!intent || !shippingRequestMatchesAccount(intent.requestSnapshot, reference, runtime) ||
    (event.businessReference !== null && event.businessReference !== reference)) return "ignored";
  const fingerprint = shippingEventFingerprint(runtime, event);
  const rawPayload = JSON.stringify(event);
  if (Buffer.byteLength(rawPayload, "utf8") > 60_000) throw new Error("Carrier event exceeds supported storage");
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, intent.orderId)).limit(1).for("update");
    if (!order || !await binding(tx, reference, runtime)) return "ignored";
    const [ship] = await tx.select().from(shipments).where(eq(shipments.trackingNumber, event.trackingNumber)).limit(1).for("update");
    if (ship && (ship.orderId !== order.id || ship.idempotencyKey !== reference)) return "ignored";
    const [existing] = await tx.select().from(shipmentEvents).where(eq(shipmentEvents.eventFingerprint, fingerprint)).limit(1).for("update");
    if (existing?.processedAt) {
      if (!existing.stateRecordedAt && ship) {
        if (existing.processingError !== "CONFLICTING_EVENT") await recordCarrierShippingFacts(tx, order, ship, event,
          ship.providerEventAtMs === event.atMs && ship.rawProviderCode === event.stateCode, ship.collectionConfirmed || event.confirmedDelivery === true);
        await tx.update(shipmentEvents).set({ stateRecordedAt: new Date() }).where(eq(shipmentEvents.id, existing.id));
      }
      return "processed";
    }
    let eventId = existing?.id;
    if (eventId === undefined) {
      const [inserted] = await tx.insert(shipmentEvents).values({ shipmentId: ship?.id ?? null, eventFingerprint: fingerprint,
        trackingNumber: event.trackingNumber, businessReference: reference, providerAccountKey: runtime.accountKey,
        providerEventAtMs: event.atMs, rawPayload, rawProviderCode: event.stateCode, rawProviderState: event.stateName }).$returningId();
      eventId = inserted.id;
    }
    if (!ship) return "pending";
    const processingError = await apply(tx, order, ship, event);
    await tx.update(shipmentEvents).set({ shipmentId: ship.id, processedAt: new Date(), stateRecordedAt: new Date(), processingError }).where(eq(shipmentEvents.id, eventId));
    return "processed";
  });
}

export async function processPendingShippingEvents(runtime: BostaSyncRuntime, limit = 10): Promise<number> {
  const pending = await db.select({ event: shipmentEvents }).from(shipmentEvents)
    .innerJoin(shipments, eq(shipments.trackingNumber, shipmentEvents.trackingNumber)).where(and(or(isNull(shipmentEvents.processedAt), isNull(shipmentEvents.stateRecordedAt)),
    eq(shipmentEvents.providerAccountKey, runtime.accountKey))).orderBy(asc(shipmentEvents.id)).limit(limit);
  let processed = 0;
  for (const { event: row } of pending) {
    const result = await recordShippingObservation(runtime, JSON.parse(row.rawPayload) as BostaObservation);
    if (result === "processed") processed++;
  }
  return processed;
}
