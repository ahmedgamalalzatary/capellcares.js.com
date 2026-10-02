import { db } from "@capella/database/src/db";
import { checkoutReservations, collectionItems, offerItems, orderItems, orders, orderReviewFlags, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { and, eq, gt, gte, isNotNull, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { allowedPaymentStatuses, generateOrderCode, generatePendingOrderCode } from "./shared.js";
import { enqueueOrderDelivery, stopUnsentDelivery, flagShippingOrder } from "../../shipping/shipping-dispatch.repository.js";
import { untouchedShippingExpiryApplies } from "../../shipping/shipping-state.repository.js";
import { requestShippingCancellationInTransaction, ShippingCancellationError } from "../../shipping/shipping-cancellation.repository.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class ShippingCustodyRequiredError extends Error {
  constructor() { super("Check shipping cancellation and warehouse custody before rejecting this order"); }
}

export class ShippingCodPaymentManagedError extends Error {
  constructor() { super("Shipping COD payment is managed by verified Bosta collection"); }
}

export class DeniedOrderLockedError extends Error {
  constructor() {
    super("Denied orders are locked");
  }
}

export class PaidPaymobRefundRequiredError extends Error {
  constructor() {
    super("Refund the Paymob payment in Paymob first");
  }
}

export class PaymobPaymentStatusManagedError extends Error {
  constructor() {
    super("Payment status is managed by Paymob");
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

/**
 * Atomically decrements variant stock only if enough is available. The conditional
 * `WHERE stockQty >= requiredQty` makes the check-and-decrement a single statement, so
 * concurrent orders cannot both pass a stale read and oversell (and a variant appearing
 * in multiple lines is re-checked against current stock each time).
 */
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
    shippingAmountCents?: number;
    shippingQuoteId?: string | null;
    shippingSize?: "small" | "medium" | "large" | null;
    shippingSnapshot?: string | null;
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

    await enqueueOrderDelivery(tx, order.id);
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

    if (existing.paymentMethod === "paymob" && paymentStatus !== "denied") {
      throw new PaymobPaymentStatusManagedError();
    }

    if (existing.paymentMethod === "cod" && paymentStatus !== "denied" &&
      (existing.shippingSnapshot || existing.shippingQuoteId || existing.shippingAmountCents > 0)) throw new ShippingCodPaymentManagedError();

    if (paymentStatus === "denied" && existing.paymentMethod === "paymob" &&
      existing.providerPaymentStatus !== "refunded") {
      throw new PaidPaymobRefundRequiredError();
    }

    if (paymentStatus === "denied") {
      if (existing.shippingSnapshot) {
        try { await requestShippingCancellationInTransaction(tx, existing, "staff", { requireUnsent: true }); }
        catch (error) { if (error instanceof ShippingCancellationError) throw new ShippingCustodyRequiredError(); throw error; }
        return;
      }
      if (!await stopUnsentDelivery(tx, id)) throw new ShippingCustodyRequiredError();
      if (existing.paymentMethod === "paymob") {
        const [attempt] = await tx.select({ checkoutSessionId: paymentAttempts.checkoutSessionId })
          .from(paymentAttempts).where(eq(paymentAttempts.id, existing.paymentAttemptId ?? -1)).limit(1);
        const reservations = attempt ? await tx.select().from(checkoutReservations)
          .where(and(eq(checkoutReservations.checkoutSessionId, attempt.checkoutSessionId),
            eq(checkoutReservations.state, "finalized"))).for("update") : [];
        if (reservations.length === 0) throw new Error("Paymob reservation snapshot is missing");
        for (const reservation of reservations) {
          await incrementVariantStock(tx, reservation.variantId, reservation.qty);
        }
      } else {
        await restockOrderItems(tx, id);
      }
    }

    await tx.update(orders).set({ paymentStatus }).where(eq(orders.id, id));
  });
}

/** How many expired orders one sweep may examine. Bounds lock hold time and drain time. */
export const ORDER_EXPIRY_BATCH_SIZE = 50;

/**
 * The order id discovery resumes after, so a block of persistently failing orders cannot
 * monopolise every batch. Reset to 0 once a batch drains.
 */
let expiryDiscoveryCursor = 0;

/**
 * D24/D39: the untouched deadline is order creation + 96 hours, fixed and never extended.
 * D27/D49/D50: only untouched orders qualify, and automatic denial/restocking is COD-only;
 * an untouched paid order raises a staff flag and is never refunded or restocked here.
 */
export async function expirePendingCodOrders(now: Date, options: { isStopped?: () => boolean } = {}): Promise<void> {
  // Pass 1: bounded, unlocked discovery. The previous version discovered EVERY eligible
  // order with no limit and then handled the whole set inside ONE transaction, so a large
  // backlog held every order's row lock for the length of the entire batch and nothing could
  // make progress. Discovery is now capped and each order is handled on its own.
  //
  // Discovery resumes after the last failure. Per-order error handling lets the current
  // batch continue, but a failing order stays eligible, so without this every sweep would
  // select the same lowest ids and the orders behind a block of failures would never expire
  // at all. A fully healthy batch resets the cursor, so a record that later stops failing is
  // retried rather than abandoned. The cursor is per-process, so a restart retries from the
  // beginning, which is the safe direction: an order is retried, never skipped.
  const afterId = expiryDiscoveryCursor;
  const candidates = await db.select({ id: orders.id }).from(orders).where(and(
    gt(orders.id, afterId),
    isNull(orders.cancellationStatus),
    lte(orders.codExpiresAt, now),
    isNull(orders.shippingPickupAtMs),
    or(isNull(orders.shippingProcessingAtMs), isNotNull(orders.shippingAddressBlockedAtMs)),
    or(
      and(eq(orders.paymentMethod, "cod"), eq(orders.paymentStatus, "pending")),
      and(eq(orders.paymentMethod, "paymob"), eq(orders.paymentStatus, "accepted"),
        eq(orders.refundedAmountCents, 0),
        notExists(db.select({ id: orderReviewFlags.id }).from(orderReviewFlags).where(and(
          eq(orderReviewFlags.orderId, orders.id), eq(orderReviewFlags.flagType, "untouched_paid")))))
    )
  )).orderBy(orders.id).limit(ORDER_EXPIRY_BATCH_SIZE);

  // A batch shorter than the limit means the backlog past the cursor is drained, so the next
  // sweep starts from the beginning again rather than permanently skipping the skipped ids.
  if (candidates.length < ORDER_EXPIRY_BATCH_SIZE) expiryDiscoveryCursor = 0;

  // Pass 2: one short transaction per order, so no lock is held across the batch.
  for (const candidate of candidates) {
    // Shutdown is checked between records, not only between sweeps: a stop request during a
    // long backlog must not have to wait for every remaining order to be processed.
    if (options.isStopped?.()) return;
    if (await expirePendingCodOrder(candidate.id, now)) continue;
    // Only advance past a genuine failure, and only once a later order has been reached, so
    // the cursor cannot skip an order that was never examined.
    if (candidates.some((later) => later.id > candidate.id)) expiryDiscoveryCursor = candidate.id;
  }
}

/**
 * Whether `expirePendingCodOrder` succeeded.
 *
 * `false` means the order raised. That is the only signal the discovery cursor needs, and it
 * is deliberately not an outcome about the order's business state: an order skipped because it
 * was cancelled or already handled is a success here, since nothing is left to retry.
 */
async function expirePendingCodOrder(orderId: number, now: Date): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      // Recheck under the order lock: the row may have changed since discovery.
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order || order.cancellationStatus !== null || order.codExpiresAt === null || order.codExpiresAt > now ||
        !untouchedShippingExpiryApplies(order)) return;
      if (order.paymentMethod === "paymob") {
        if (order.paymentStatus !== "accepted" || order.refundedAmountCents > 0) return;
        // The deadline is a single fixed event (D39), so a staff-acknowledged alert must not
        // return on the next sweep; unlike carrier state it never becomes relevant again.
        const [alreadyRaised] = await tx.select({ id: orderReviewFlags.id }).from(orderReviewFlags).where(and(
          eq(orderReviewFlags.orderId, order.id), eq(orderReviewFlags.flagType, "untouched_paid"))).limit(1).for("update");
        if (alreadyRaised) return;
        await flagShippingOrder(tx, order.id, "untouched_paid",
          "Paid order passed the 96-hour deadline with no processing; no automatic refund or restocking applies");
        return;
      }
      if (order.paymentStatus !== "pending") return;
      if (order.shippingSnapshot) {
        await requestShippingCancellationInTransaction(tx, order, "expiry", { now });
        return;
      }
      if (!await stopUnsentDelivery(tx, order.id)) {
        await flagShippingOrder(tx, order.id, "expiry_review", "COD deadline reached; carrier outcome/custody is unverified, stock retained");
        return;
      }
      await restockOrderItems(tx, order.id);
      await tx.update(orders).set({ paymentStatus: "denied" }).where(and(
        eq(orders.id, order.id),
        eq(orders.paymentStatus, "pending")
      ));
    });
    return true;
  } catch (error) {
    // One order failing must not abort the rest of the batch: the sweep would then keep
    // rediscovering the same failing record first and never progress past it.
    //
    // Only the order id and the error class are logged. The raw error can carry driver
    // details, and an order id is already visible to staff through the ERP order list.
    console.error("Order expiry sweep could not process an order", {
      orderId,
      error: error instanceof Error ? error.name : "UnknownError"
    });
    return false;
  }
}
