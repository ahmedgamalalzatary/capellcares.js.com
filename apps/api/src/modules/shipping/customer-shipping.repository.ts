import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shipmentEvents, orderStateHistory, shippingWorkItems } from "@capella/database/drizzle/schema";
import type { CustomerOrderFulfillment } from "@capella/shared";
import { cancellationRefundDue, directCancellationBlockedByFacts } from "./shipping-cancellation.repository.js";

/** Batch owned-order facts without exposing provider payloads, staff flags or audit reasons. */
export async function customerShippingStates(rows: typeof orders.$inferSelect[]) {
  const states = new Map<number, CustomerOrderFulfillment>();
  const ids = rows.filter(order => order.shippingSnapshot).map(order => order.id);
  if (!ids.length) return states;
  const linked = await db.select().from(shipments).where(inArray(shipments.orderId, ids)).orderBy(asc(shipments.id));
  const history = await db.select({ orderId: orderStateHistory.orderId }).from(orderStateHistory)
    .where(and(inArray(orderStateHistory.orderId, ids), inArray(orderStateHistory.state, ["printed", "delivered", "returned"])));
  const jobs = await db.select().from(shippingWorkItems).where(inArray(shippingWorkItems.orderId, ids));
  const delivered = await db.select({ orderId: shipments.orderId, rawPayload: shipmentEvents.rawPayload }).from(shipmentEvents)
    .innerJoin(shipments, eq(shipments.id, shipmentEvents.shipmentId)).where(and(inArray(shipments.orderId, ids), eq(shipments.kind, "outgoing"),
      eq(shipmentEvents.rawProviderCode, 45), isNotNull(shipmentEvents.processedAt),
      or(isNull(shipmentEvents.processingError), eq(shipmentEvents.processingError, "STALE_EVENT"))));
  const deliveredIds = new Set(delivered.filter(event => {
    try {
      const saved = JSON.parse(event.rawPayload);
      return saved.confirmedDelivery === true && ["SEND", "FXF_SEND"].includes(saved.type);
    } catch { return false; }
  }).map(event => event.orderId));
  const barrierIds = new Set(history.map(event => event.orderId));
  const shipsByOrder = new Map<number, typeof linked>();
  const jobsByOrder = new Map<number, typeof jobs>();
  for (const ship of linked) {
    const bucket = shipsByOrder.get(ship.orderId);
    if (bucket) bucket.push(ship); else shipsByOrder.set(ship.orderId, [ship]);
  }
  for (const job of jobs) {
    const bucket = jobsByOrder.get(job.orderId);
    if (bucket) bucket.push(job); else jobsByOrder.set(job.orderId, [job]);
  }
  for (const order of rows) {
    if (!order.shippingSnapshot) continue;
    const ships = shipsByOrder.get(order.id) ?? [];
    const ship = ships.find(row => row.kind === "outgoing");
    const work = jobsByOrder.get(order.id) ?? [];
    const pendingEdit = work.some(job => job.operation === "edit_delivery" && ["processing", "review_required"].includes(job.status));
    const cancellation = work.find(job => job.idempotencyKey === `bosta_cancel_order_${order.id}`);
    const stage = deliveredIds.has(order.id) ? "delivered" : order.shippingPickupAtMs !== null ? "shipped"
      : order.shippingProcessingAtMs !== null ? "preparing" : "placed";
    let status: CustomerOrderFulfillment["status"] = "active";
    let issue: CustomerOrderFulfillment["issue"] = null;
    if (order.cancellationStatus === "cancelled" || order.paymentStatus === "denied") status = "cancelled";
    else if (order.cancellationStatus === "pending") status = "cancellation_pending";
    else if (ship?.normalizedState === "cancelled") status = "carrier_cancelled";
    else if (ship?.normalizedState === "returned") status = "returned";
    else if (order.shippingAddressBlockedAtMs !== null) { status = "delayed"; issue = "address"; }
    else if (ship?.normalizedState === "exception") {
      status = ship.rawProviderCode === 105 ? "delayed" : "exception";
      issue = ship.rawProviderCode === 100 ? "lost" : ship.rawProviderCode === 101 ? "damaged" : "delivery";
    } else if (ship?.rawProviderType === "RTO") status = "returning";
    else if (ship?.rawProviderType === "EXCHANGE") status = "exchanging";
    else if (!ship && work.some(job => job.operation === "create_delivery" && ["failed", "review_required"].includes(job.status) && job.lastError !== "ORDER_NOT_DISPATCHABLE")) status = "delayed";
    const refundStatus = order.paymentMethod !== "paymob" ? null : order.providerPaymentStatus === "refunded" ? "refunded"
      : order.providerPaymentStatus === "partially_refunded" ? "partially_refunded" : cancellationRefundDue(order) > 0 ? "pending" : null;
    states.set(order.id, { stage, status, issue, refundStatus, relatedShipments: ships.filter(row => row.kind !== "outgoing")
      .map(row => ({ kind: row.kind as "return" | "exchange", status: row.normalizedState })),
      canCancel: order.customerType === "registered" && order.cancellationStatus === null && order.paymentStatus !== "denied" &&
        !(order.refundedAmountCents > 0 && order.refundedAmountCents !== Math.round(Number(order.totalAmount) * 100)) && !pendingEdit &&
        !directCancellationBlockedByFacts(order, ship, barrierIds.has(order.id), cancellation?.responseSnapshot ?? null) });
  }
  return states;
}
