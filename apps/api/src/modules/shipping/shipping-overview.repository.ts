import { db } from "@capella/database/src/db";
import { orderReviewFlags, orders, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { PAGE_SIZE, pageMeta, type AdminShipmentListItemDto } from "@capella/shared";
import { z } from "zod";
import { likeContains, pagedQuerySchema, pageWindow } from "../../lib/pagination.js";
import { toNumber } from "../orders/order/shared.js";

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
    // The order's manual state describes its outgoing parcel; linked return/exchange shipments carry only their own manual state.
    manualState: kind === "outgoing"
      ? order.manualShippingState ?? shipment?.manualState ?? null
      : shipment?.manualState ?? null,
    custodyState: shipment?.custodyState ?? "unknown",
    size: shipment?.size ?? order.shippingSize ?? null,
    carrierSize: carrierSize(shipment),
    shippingAmountCents: shipment?.shippingAmountCents ?? order.shippingAmountCents,
    collectedAmountCents: shipment?.collectedAmountCents ?? null,
    collectionConfirmed: shipment?.collectionConfirmed ?? false,
    // Cancellation is an order-level outgoing decision; linked return/exchange shipments must not report or be filtered by it.
    cancellationStatus: kind === "outgoing" ? order.cancellationStatus : null,
    openFlagTypes,
    needsAttention: openFlagTypes.length > 0 ||
      (workItem !== null && ATTENTION_WORK_STATUSES.has(workItem.status) && !isExpectedStop(workItem)),
    workItem: workItem ? { operation: workItem.operation, status: workItem.status, lastError: workItem.lastError } : null
  };
}

/** A create_delivery job failed with ORDER_NOT_DISPATCHABLE was intentionally stopped by a cancellation or refund block, so it is not an open failure needing staff attention. */
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

/** Every list row (outgoing parcel + each return/exchange) for these orders, built with the same rules as before paging moved to SQL. */
async function buildRowsForOrders(page: Order[]): Promise<AdminShipmentListItemDto[]> {
  if (page.length === 0) return [];
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
  return rows;
}

const SORT_KEYS = ["code", "kind", "tracking", "customer", "carrier", "manual", "custody", "size", "shipping", "payment", "date"] as const;
type ShippingSortKey = (typeof SORT_KEYS)[number];

export const shippingListQuerySchema = pagedQuerySchema(SORT_KEYS, {
  section: z.enum(["all", "needs_attention", "returns"]).optional(),
  status: z.enum(shipments.normalizedState.enumValues).optional(),
  payment: z.enum(orders.paymentMethod.enumValues).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional()
});

type ShippingListParams = z.output<typeof shippingListQuerySchema>;
export type ShippingListQuery = Pick<ShippingListParams, "page" | "dir"> & Partial<Omit<ShippingListParams, "page" | "dir">>;

// "A job needs a person" for a row's work items: a failed or review-required job, except a create job stopped on
// purpose by a cancellation/refund block. This is exactly when `pickWorkItem` + `rowFor` report needsAttention: an
// attention job always wins the pick unless every candidate is such an expected stop.
const attentionJob = sql.raw(`w.status IN ('failed', 'review_required')
  AND NOT (w.operation = 'create_delivery' AND w.status = 'failed' AND COALESCE(w.last_error, '') = 'ORDER_NOT_DISPATCHABLE')`);
const openFlag = sql.raw("EXISTS (SELECT 1 FROM order_review_flags f WHERE f.order_id = o.id AND f.status = 'open')");

// Every list row in SQL: each shipping order's outgoing parcel (its latest outgoing shipment, if any) and each
// return/exchange shipment, with the columns the list searches, filters and sorts by. Mirrors `rowFor`.
const shippingRows = sql`(
  SELECT o.id AS order_id, s.id AS shipment_id, 'outgoing' AS kind, o.order_code, o.full_name AS customer_name,
    o.phone AS customer_phone, s.tracking_number, s.normalized_state AS carrier_state,
    COALESCE(o.manual_shipping_state, s.manual_state) AS manual_state, COALESCE(s.custody_state, 'unknown') AS custody_state,
    COALESCE(s.size, o.shipping_size) AS size, COALESCE(s.shipping_amount_cents, o.shipping_amount_cents) AS shipping_amount_cents,
    o.payment_method, o.created_at AS order_created_at, o.cancellation_status,
    (${openFlag} OR EXISTS (SELECT 1 FROM shipping_work_items w WHERE w.order_id = o.id
      AND (w.shipment_id IS NULL OR w.shipment_id = s.id) AND ${attentionJob})) AS needs_attention
  FROM orders o
  LEFT JOIN shipments s ON s.id = (SELECT MAX(s2.id) FROM shipments s2 WHERE s2.order_id = o.id AND s2.kind = 'outgoing')
  WHERE o.shipping_snapshot IS NOT NULL
  UNION ALL
  SELECT o.id, s.id, s.kind, o.order_code, o.full_name, o.phone, s.tracking_number, s.normalized_state,
    s.manual_state, s.custody_state, s.size, s.shipping_amount_cents, o.payment_method, o.created_at, NULL,
    (${openFlag} OR EXISTS (SELECT 1 FROM shipping_work_items w WHERE w.order_id = o.id
      AND w.shipment_id = s.id AND ${attentionJob}))
  FROM shipments s
  JOIN orders o ON o.id = s.order_id
  WHERE s.kind <> 'outgoing' AND o.shipping_snapshot IS NOT NULL
) AS r`;

/** Natural order of an enum column (its declared order), with empty values last in both directions. */
function enumOrder(column: string, values: readonly string[], dir: "asc" | "desc") {
  const list = sql.join(values.map((value) => sql`${value}`), sql`, `);
  return sql`${sql.raw(column)} IS NULL, FIELD(${sql.raw(column)}, ${list}) ${sql.raw(dir)}`;
}

function plainOrder(column: string, dir: "asc" | "desc") {
  return sql`${sql.raw(column)} IS NULL, ${sql.raw(column)} ${sql.raw(dir)}`;
}

function sortClause(sort: ShippingSortKey, dir: "asc" | "desc") {
  switch (sort) {
    case "kind": return enumOrder("r.kind", shipments.kind.enumValues, dir);
    case "carrier": return enumOrder("r.carrier_state", shipments.normalizedState.enumValues, dir);
    case "manual": return enumOrder("r.manual_state", shipments.manualState.enumValues, dir);
    case "custody": return enumOrder("r.custody_state", shipments.custodyState.enumValues, dir);
    case "size": return enumOrder("r.size", shipments.size.enumValues, dir);
    case "payment": return enumOrder("r.payment_method", orders.paymentMethod.enumValues, dir);
    case "code": return plainOrder("r.order_code", dir);
    case "tracking": return plainOrder("r.tracking_number", dir);
    case "customer": return plainOrder("r.customer_name", dir);
    case "shipping": return plainOrder("r.shipping_amount_cents", dir);
    case "date": return plainOrder("r.order_created_at", dir);
  }
}

type KeyRow = { order_id: number; shipment_id: number | null; kind: string };

/** One page of the ERP shipping list, with search, filters and sort applied in the database. */
export async function listShippingPageRepo(query: ShippingListQuery, pageSize = PAGE_SIZE) {
  const conditions: SQL[] = [];
  if (query.section === "needs_attention") conditions.push(sql`r.needs_attention`);
  if (query.section === "returns") conditions.push(sql`r.kind <> 'outgoing'`);
  // "Cancelled" also covers an outgoing order cancelled locally before any carrier shipment existed.
  if (query.status === "cancelled") {
    conditions.push(sql`(r.carrier_state = 'cancelled' OR (r.carrier_state IS NULL AND r.cancellation_status = 'cancelled'))`);
  } else if (query.status) {
    conditions.push(sql`r.carrier_state = ${query.status}`);
  }
  if (query.payment) conditions.push(sql`r.payment_method = ${query.payment}`);
  if (query.from) conditions.push(sql`r.order_created_at >= ${new Date(query.from)}`);
  if (query.to) conditions.push(sql`r.order_created_at <= ${new Date(query.to)}`);
  if (query.q) {
    const pattern = likeContains(query.q);
    conditions.push(sql`(r.order_code LIKE ${pattern} OR r.customer_name LIKE ${pattern}
      OR r.customer_phone LIKE ${pattern} OR r.tracking_number LIKE ${pattern})`);
  }
  const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const newestFirst = sql`r.order_created_at DESC, r.order_id DESC, r.kind = 'outgoing' DESC, r.shipment_id DESC`;
  const orderBy = query.sort ? sql`${sortClause(query.sort, query.dir)}, ${newestFirst}` : newestFirst;
  const span = pageWindow(query.page, pageSize);

  const [countResult, keyResult] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) AS total FROM ${shippingRows} ${where}`),
    db.execute(sql`SELECT r.order_id, r.shipment_id, r.kind FROM ${shippingRows} ${where}
      ORDER BY ${orderBy} LIMIT ${span.limit} OFFSET ${span.offset}`)
  ]);
  const total = Number((countResult[0] as unknown as Array<{ total: number | string }>)[0]?.total ?? 0);
  const keys = keyResult[0] as unknown as KeyRow[];

  const orderIds = [...new Set(keys.map((key) => key.order_id))];
  const orderRows = orderIds.length > 0 ? await db.select().from(orders).where(inArray(orders.id, orderIds)) : [];
  const rowKey = (orderId: number, kind: string, shipmentId: number | null) => `${orderId}:${kind}:${shipmentId}`;
  const built = new Map((await buildRowsForOrders(orderRows)).map((row) => [rowKey(row.orderId, row.kind, row.shipmentId), row]));
  return {
    items: keys
      .map((key) => built.get(rowKey(key.order_id, key.kind, key.shipment_id)))
      .filter((row): row is AdminShipmentListItemDto => row != null),
    pagination: pageMeta(total, query.page, pageSize)
  };
}
