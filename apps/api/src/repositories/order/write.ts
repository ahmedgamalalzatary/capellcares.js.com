import { db } from "@capella/database/src/db";
import { checkoutReservations, collectionItems, offerItems, orderItems, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { allowedPaymentStatuses, generateOrderCode, generatePendingOrderCode } from "./shared.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  snapshotComponents?: Array<{ variantId: number; qty: number; unitPrice?: number }> | null;
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
      const components = JSON.parse(item.snapshotComponents) as Array<{ variantId: number; qty: number }>;
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
      .select({ paymentStatus: orders.paymentStatus, paymentMethod: orders.paymentMethod,
        paymentAttemptId: orders.paymentAttemptId,
        providerPaymentStatus: orders.providerPaymentStatus })
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

    if (paymentStatus === "denied" && existing.paymentMethod === "paymob" &&
      existing.providerPaymentStatus !== "refunded") {
      throw new PaidPaymobRefundRequiredError();
    }

    if (paymentStatus === "denied") {
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
