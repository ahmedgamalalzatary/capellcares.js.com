import { db } from "@capella/database/src/db";
import { collectionItems, offerItems, orderItems, orders, productVariants } from "@capella/database/drizzle/schema";
import { and, eq, gt, gte, lte, sql } from "drizzle-orm";
import { allowedPaymentStatuses, generateOrderCode, generatePendingOrderCode } from "./shared.js";
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class DeniedOrderLockedError extends Error {
  constructor() {
    super("Denied orders are locked");
  }
}

export class OrderNotFoundError extends Error {
  constructor(orderId: number) {
    super(`Order not found: ${orderId}`);
  }
}

interface OrderItem {
  variantId: number | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  itemType?: "product_variant" | "offer" | "collection";
  offerId?: number | null;
  collectionId?: number | null;
  snapshotNameAr?: string | null;
  snapshotNameEn?: string | null;
  snapshotSizeLabel?: string | null;
  snapshotComponents?: Array<{ variantId: number; qty: number; unitPrice?: number; sizeLabel?: string | null }> | null;
  snapshotBaseUnitPrice?: number | null;
  snapshotDiscountId?: number | null;
  snapshotDiscountType?: "percentage" | "fixed" | null;
  snapshotDiscountValue?: number | null;
  snapshotDiscountStartsAt?: string | null;
  snapshotDiscountEndsAt?: string | null;
}

/** Atomically decrements variant stock only if enough is available. */
async function decrementVariantStock(tx: DbTransaction, variantId: number, requiredQty: number) {
  const result = await tx
    .update(productVariants)
    .set({ stockQty: sql`${productVariants.stockQty} - ${requiredQty}` })
    .where(and(eq(productVariants.id, variantId), gte(productVariants.stockQty, requiredQty)));
  if (result[0].affectedRows !== 1) {
    throw new Error("Insufficient stock");
  }
}

async function incrementVariantStock(tx: DbTransaction, variantId: number, qty: number) {
  await tx
    .update(productVariants)
    .set({ stockQty: sql`${productVariants.stockQty} + ${qty}` })
    .where(eq(productVariants.id, variantId));
}

function buildMissingOrderItemIdError(orderId: number, item: {
  itemType: "product_variant" | "offer" | "collection";
  variantId: number | null;
  offerId: number | null;
  collectionId: number | null;
  qty: number;
}, missingField: "variantId" | "offerId" | "collectionId") {
  return new Error(
    `Cannot restock orderId=${orderId}: ${item.itemType} order item is missing ${missingField} (${JSON.stringify(item)})`
  );
}

async function restockOrderItems(tx: DbTransaction, orderId: number) {
  const items = await tx
    .select({
      itemType: orderItems.itemType,
      variantId: orderItems.variantId,
      offerId: orderItems.offerId,
      collectionId: orderItems.collectionId,
      qty: orderItems.qty,
      snapshotComponents: orderItems.snapshotComponents
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if ((item.itemType === "offer" || item.itemType === "collection") && item.snapshotComponents) {
      let components: Array<{ variantId: number; qty: number }>;
      try {
        components = JSON.parse(item.snapshotComponents) as Array<{ variantId: number; qty: number }>;
      } catch {
        throw new Error("Bundle component snapshot is invalid");
      }
      if (!Array.isArray(components) || components.length === 0) throw new Error("Bundle component snapshot is invalid");
      for (const component of components) {
        if (!Number.isSafeInteger(component.variantId) || !Number.isSafeInteger(component.qty) || component.qty <= 0) {
          throw new Error("Bundle component snapshot is invalid");
        }
        await incrementVariantStock(tx, component.variantId, component.qty * item.qty);
      }
      continue;
    }
    if (item.itemType === "offer") {
      if (item.offerId == null) {
        throw buildMissingOrderItemIdError(orderId, item, "offerId");
      }
      const underlyingItems = await tx
        .select({
          variantId: offerItems.variantId,
          bundleQty: offerItems.qty
        })
        .from(offerItems)
        .where(eq(offerItems.offerId, item.offerId));

      for (const underlyingItem of underlyingItems) {
        await incrementVariantStock(tx, underlyingItem.variantId, underlyingItem.bundleQty * item.qty);
      }
      continue;
    }

    if (item.itemType === "collection") {
      if (item.collectionId == null) {
        throw buildMissingOrderItemIdError(orderId, item, "collectionId");
      }
      const underlyingItems = await tx
        .select({
          variantId: collectionItems.variantId,
          bundleQty: collectionItems.qty
        })
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, item.collectionId));

      for (const underlyingItem of underlyingItems) {
        await incrementVariantStock(tx, underlyingItem.variantId, underlyingItem.bundleQty * item.qty);
      }
      continue;
    }

    if (item.variantId == null) {
      throw buildMissingOrderItemIdError(orderId, item, "variantId");
    }
    await incrementVariantStock(tx, item.variantId, item.qty);
  }
}

export async function createOrderWithItems(input: {
  order: {
    customerType: "guest" | "registered";
    customerId: number | null;
    fullName: string;
    phone: string;
    email: string;
    governorate: string;
    cityArea: string;
    addressLine: string;
    buildingApartment: string;
    notes: string;
    paymentMethod: "cod";
    paymentStatus: "pending" | "accepted" | "denied";
    idempotencyKey?: string | null;
    checkoutFingerprint?: string | null;
    codExpiresAt?: Date | null;
    totalAmount: number;
  };
  items: OrderItem[];
}) {
  return db.transaction(async (tx) => {
    for (const item of input.items) {
      if (item.itemType === "offer") {
        if (item.offerId == null) {
          throw new Error("Order item.itemType=offer requires non-null item.offerId before querying offerItems");
        }

        if (!item.snapshotComponents) {
          const underlyingItems = await tx.select({ variantId: offerItems.variantId, bundleQty: offerItems.qty })
            .from(offerItems).where(eq(offerItems.offerId, item.offerId));
          if (underlyingItems.length === 0) throw new Error(`No offerItems found for item.offerId=${item.offerId}`);
          item.snapshotComponents = underlyingItems.map(({ variantId, bundleQty }) => ({ variantId, qty: bundleQty }));
        }

        for (const component of item.snapshotComponents) {
          await decrementVariantStock(tx, component.variantId, component.qty * item.qty);
        }
      } else {
        if (item.itemType === "collection") {
          if (item.collectionId == null) {
            throw new Error("Order item.itemType=collection requires non-null item.collectionId before querying collectionItems");
          }

          if (!item.snapshotComponents) {
            const underlyingItems = await tx.select({ variantId: collectionItems.variantId, bundleQty: collectionItems.qty })
              .from(collectionItems).where(eq(collectionItems.collectionId, item.collectionId));
            if (underlyingItems.length === 0) throw new Error(`No collectionItems found for item.collectionId=${item.collectionId}`);
            item.snapshotComponents = underlyingItems.map(({ variantId, bundleQty }) => ({ variantId, qty: bundleQty }));
          }

          for (const component of item.snapshotComponents) {
            await decrementVariantStock(tx, component.variantId, component.qty * item.qty);
          }
          continue;
        }

        if (item.variantId == null) {
          throw new Error("Order item requires non-null item.variantId before calling decrementVariantStock");
        }
        await decrementVariantStock(tx, item.variantId, item.qty);
      }
    }

    const [order] = await tx.insert(orders).values({
      ...input.order,
      orderCode: generatePendingOrderCode(),
      totalAmount: sql`${input.order.totalAmount}`
    }).$returningId();

    const orderCode = generateOrderCode(order.id);

    await tx
      .update(orders)
      .set({ orderCode })
      .where(eq(orders.id, order.id));

    await tx.insert(orderItems).values(
      input.items.map((item) => ({
        orderId: order.id,
        itemType: item.itemType ?? "product_variant",
        variantId: item.variantId ?? null,
        offerId: item.offerId ?? null,
        collectionId: item.collectionId ?? null,
        qty: item.qty,
        unitPrice: sql`${item.unitPrice}`,
        lineTotal: sql`${item.lineTotal}`,
        snapshotNameAr: item.snapshotNameAr ?? null,
        snapshotNameEn: item.snapshotNameEn ?? null,
        snapshotSizeLabel: item.snapshotSizeLabel ?? null,
        snapshotComponents: item.snapshotComponents ? JSON.stringify(item.snapshotComponents) : null,
        snapshotBaseUnitPrice: item.snapshotBaseUnitPrice == null ? null : sql`${item.snapshotBaseUnitPrice}`,
        snapshotDiscountId: item.snapshotDiscountId ?? null,
        snapshotDiscountType: item.snapshotDiscountType ?? null,
        snapshotDiscountValue: item.snapshotDiscountValue == null ? null : sql`${item.snapshotDiscountValue}`,
        snapshotDiscountStartsAt: item.snapshotDiscountStartsAt == null ? null : new Date(item.snapshotDiscountStartsAt),
        snapshotDiscountEndsAt: item.snapshotDiscountEndsAt == null ? null : new Date(item.snapshotDiscountEndsAt)
      }))
    );

    return { id: order.id, orderCode };
  });
}

export async function updateOrderPaymentStatusRepo(
  id: number,
  paymentStatus: "pending" | "accepted" | "denied"
) {
  if (!allowedPaymentStatuses.has(paymentStatus)) {
    throw new Error(`updateOrderPaymentStatusRepo received invalid paymentStatus: ${String(paymentStatus)}`);
  }
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1)
      .for("update");

    if (!existing) {
      throw new OrderNotFoundError(id);
    }

    if (existing.paymentStatus === "denied") {
      throw new DeniedOrderLockedError();
    }

    if (paymentStatus === "denied") {
      await restockOrderItems(tx, id);
    }

    await tx.update(orders).set({ paymentStatus }).where(eq(orders.id, id));
  });
}

/** A customer may cancel their own order until staff accept it; the stock goes back. */
export async function cancelCustomerOrderRepo(id: number, customerId: number): Promise<"cancelled" | "not_found" | "not_cancellable"> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders)
      .where(and(eq(orders.id, id), eq(orders.customerId, customerId))).limit(1).for("update");
    if (!existing) return "not_found";
    if (existing.paymentStatus !== "pending") return "not_cancellable";
    await restockOrderItems(tx, id);
    await tx.update(orders).set({ paymentStatus: "denied" }).where(eq(orders.id, id));
    return "cancelled";
  });
}

/** How many expired orders one sweep may examine. Bounds lock hold time and drain time. */
export const ORDER_EXPIRY_BATCH_SIZE = 50;

/** The order id discovery resumes after, so an order that keeps failing cannot monopolise every batch. */
let expiryDiscoveryCursor = 0;

/** D24/D39: the untouched deadline is order creation + 96 hours, fixed and never extended. */
export async function expirePendingCodOrders(now: Date, options: { isStopped?: () => boolean } = {}): Promise<void> {
  // Pass 1: bounded, unlocked discovery.
  const afterId = expiryDiscoveryCursor;
  const candidates = await db.select({ id: orders.id }).from(orders).where(and(
    gt(orders.id, afterId),
    lte(orders.codExpiresAt, now),
    eq(orders.paymentStatus, "pending")
  )).orderBy(orders.id).limit(ORDER_EXPIRY_BATCH_SIZE);

  // Pass 2: one short transaction per order, so no lock is held across the batch.
  for (const candidate of candidates) {
    // Shutdown is checked between records, not only between sweeps: a stop request during a long backlog must not have to wait for every remaining order to be processed.
    if (options.isStopped?.()) return;
    await expirePendingCodOrder(candidate.id, now);
  }

  // Advance discovery by how much of the batch was examined, regardless of how the individual orders resolved.
  expiryDiscoveryCursor = candidates.length < ORDER_EXPIRY_BATCH_SIZE
    ? 0
    : candidates[candidates.length - 1].id;
}

/** Expires one order in its own transaction. A failure is logged and swallowed so the rest of the batch can continue. */
async function expirePendingCodOrder(orderId: number, now: Date): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      // Recheck under the order lock: the row may have changed since discovery.
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order || order.codExpiresAt === null || order.codExpiresAt > now || order.paymentStatus !== "pending") return;
      await restockOrderItems(tx, order.id);
      await tx.update(orders).set({ paymentStatus: "denied" }).where(eq(orders.id, order.id));
    });
  } catch (error) {
    // One order failing must not abort the rest of the batch; it is logged and the sweep moves on to the next record.
    console.error("Order expiry sweep could not process an order", {
      orderId,
      error: error instanceof Error ? error.name : "UnknownError"
    });
  }
}
