import { db } from "@capella/database/src/db";
import { orderReviewFlags, orders, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { and, desc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import type { AdminShipmentListItemDto } from "@capella/shared";
import { toNumber } from "./order/shared.js";

type Order = typeof orders.$inferSelect;
type ShipmentRow = typeof shipments.$inferSelect;
type WorkItemRow = typeof shippingWorkItems.$inferSelect;

const UNRESOLVED_WORK_STATUSES = new Set(["pending", "processing", "failed", "review_required"]);
const ATTENTION_WORK_STATUSES = new Set(["failed", "review_required"]);

function carrierSize(shipment: ShipmentRow | null): string | null {
  if (!shipment?.carrierSnapshot) return null;
  try {
    const size = (JSON.parse(shipment.carrierSnapshot) as { size?: unknown }).size;
    return typeof size === "string" && size.length > 0 ? size : null;
  } catch {
    return null;
  }
}

function rowFor(order: Order, shipment: ShipmentRow | null, kind: ShipmentRow["kind"],
  workItem: WorkItemRow | null, openFlagTypes: AdminShipmentListItemDto["openFlagTypes"]): AdminShipmentListItemDto {
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    customerName: order.fullName,
    customerPhone: order.phone,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    providerPaymentStatus: order.providerPaymentStatus,
    totalAmount: toNumber(order.totalAmount),
    orderCreatedAt: order.createdAt.toISOString(),
    shipmentId: shipment?.id ?? null,
    kind,
    trackingNumber: shipment?.trackingNumber ?? null,
    carrierState: shipment?.normalizedState ?? null,
    rawProviderState: shipment?.rawProviderState ?? null,
    // The order's manual state describes its outgoing parcel; linked return/exchange
    // shipments carry only their own manual state.
    manualState: kind === "outgoing"
      ? order.manualShippingState ?? shipment?.manualState ?? null
      : shipment?.manualState ?? null,
    custodyState: shipment?.custodyState ?? "unknown",
    size: shipment?.size ?? order.shippingSize ?? null,
    carrierSize: carrierSize(shipment),
    shippingAmountCents: shipment?.shippingAmountCents ?? order.shippingAmountCents,
    collectedAmountCents: shipment?.collectedAmountCents ?? null,
    collectionConfirmed: shipment?.collectionConfirmed ?? false,
    // Cancellation is an order-level outgoing decision; linked return/exchange shipments
    // must not report or be filtered by it.
    cancellationStatus: kind === "outgoing" ? order.cancellationStatus : null,
    openFlagTypes,
    needsAttention: openFlagTypes.length > 0 ||
      (workItem !== null && ATTENTION_WORK_STATUSES.has(workItem.status) && !isExpectedStop(workItem)),
    workItem: workItem ? { operation: workItem.operation, status: workItem.status, lastError: workItem.lastError } : null
  };
}

/** A create_delivery job failed with ORDER_NOT_DISPATCHABLE was intentionally stopped by a
 *  cancellation or refund block, so it is not an open failure needing staff attention. */
function isExpectedStop(item: WorkItemRow): boolean {
  return item.operation === "create_delivery" && item.status === "failed" && item.lastError === "ORDER_NOT_DISPATCHABLE";
}

/** Prefer an unresolved job over a newer terminal one so a succeeded create never hides a failed cancel. */
export function pickWorkItem(candidates: WorkItemRow[]): WorkItemRow | null {
  const visible = candidates.filter((item) => item.operation !== "sync_delivery" || ATTENTION_WORK_STATUSES.has(item.status));
  if (visible.length === 0) return null;
  const actionable = visible.filter((item) => !isExpectedStop(item));
  const pool = actionable.length > 0 ? actionable : visible;
  return pool.find((item) => ATTENTION_WORK_STATUSES.has(item.status)) ??
    pool.find((item) => UNRESOLVED_WORK_STATUSES.has(item.status)) ??
    pool[0];
}

const SHIPPING_OVERVIEW_PAGE_SIZE = 100;

export interface ShippingOverviewPage {
  items: AdminShipmentListItemDto[];
  nextCursor: string | null;
}

export async function listShippingOverviewRepo(
  cursor: { createdAt: Date; id: number } | null,
  pageSize = SHIPPING_OVERVIEW_PAGE_SIZE
): Promise<ShippingOverviewPage> {
  const conditions = [isNotNull(orders.shippingSnapshot)];
  if (cursor) {
    conditions.push(or(
      lt(orders.createdAt, cursor.createdAt),
      and(eq(orders.createdAt, cursor.createdAt), lt(orders.id, cursor.id))
    )!);
  }
  const orderRows = await db.select().from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(pageSize + 1);
  const hasMore = orderRows.length > pageSize;
  const page = hasMore ? orderRows.slice(0, pageSize) : orderRows;
  if (page.length === 0) return { items: [], nextCursor: null };
  const last = page[page.length - 1];
  const nextCursor = hasMore ? `${last.createdAt.toISOString()}|${last.id}` : null;
  const orderIds = page.map((order) => order.id);

  const shipmentRows = await db.select().from(shipments).where(inArray(shipments.orderId, orderIds)).orderBy(desc(shipments.id));
  const workItemRows = await db.select().from(shippingWorkItems).where(inArray(shippingWorkItems.orderId, orderIds)).orderBy(desc(shippingWorkItems.id));
  const flagRows = await db.select({ orderId: orderReviewFlags.orderId, flagType: orderReviewFlags.flagType })
    .from(orderReviewFlags)
    .where(and(inArray(orderReviewFlags.orderId, orderIds), eq(orderReviewFlags.status, "open")));

  const outgoingByOrder = new Map<number, ShipmentRow>();
  const linkedByOrder = new Map<number, ShipmentRow[]>();
  for (const shipment of shipmentRows) {
    if (shipment.kind === "outgoing") {
      if (!outgoingByOrder.has(shipment.orderId)) outgoingByOrder.set(shipment.orderId, shipment);
    } else {
      const bucket = linkedByOrder.get(shipment.orderId) ?? [];
      bucket.push(shipment);
      linkedByOrder.set(shipment.orderId, bucket);
    }
  }
  const workItemsByOrder = new Map<number, WorkItemRow[]>();
  for (const item of workItemRows) {
    const bucket = workItemsByOrder.get(item.orderId) ?? [];
    bucket.push(item);
    workItemsByOrder.set(item.orderId, bucket);
  }
  const flagsByOrder = new Map<number, AdminShipmentListItemDto["openFlagTypes"]>();
  for (const flag of flagRows) {
    const bucket = flagsByOrder.get(flag.orderId) ?? [];
    bucket.push(flag.flagType);
    flagsByOrder.set(flag.orderId, bucket);
  }

  const workItemForRow = (orderId: number, shipment: ShipmentRow | null, kind: ShipmentRow["kind"]) => {
    const candidates = (workItemsByOrder.get(orderId) ?? []).filter((item) =>
      kind === "outgoing"
        ? shipment == null ? item.shipmentId === null : item.shipmentId === shipment.id || item.shipmentId === null
        : item.shipmentId === shipment?.id);
    return pickWorkItem(candidates);
  };

  const rows: AdminShipmentListItemDto[] = [];
  for (const order of page) {
    const outgoing = outgoingByOrder.get(order.id) ?? null;
    rows.push(rowFor(order, outgoing, "outgoing", workItemForRow(order.id, outgoing, "outgoing"),
      flagsByOrder.get(order.id) ?? []));
    for (const shipment of linkedByOrder.get(order.id) ?? []) {
      rows.push(rowFor(order, shipment, shipment.kind, workItemForRow(order.id, shipment, shipment.kind),
        flagsByOrder.get(order.id) ?? []));
    }
  }
  return { items: rows, nextCursor };
}
