import { db } from "@capella/database/src/db";
import { collectionItems, offerItems, orderItems, orders, productVariants } from "@capella/database/drizzle/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { allowedPaymentStatuses, formatDailyOrderCode, generatePendingOrderCode, type OrderCodeChannel } from "./shared.js";

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
      qty: orderItems.qty
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
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
  orderCodeChannel: OrderCodeChannel;
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
    erpManualTotalAmount?: number | null;
  };
  items: OrderItem[];
}) {
  return db.transaction(async (tx) => {
    for (const item of input.items) {
      if (item.itemType === "offer") {
        if (item.offerId == null) {
          throw new Error("Order item.itemType=offer requires non-null item.offerId before querying offerItems");
        }

        const underlyingItems = await tx
          .select({
            variantId: offerItems.variantId,
            bundleQty: offerItems.qty
          })
          .from(offerItems)
          .where(eq(offerItems.offerId, item.offerId));

        if (underlyingItems.length === 0) {
          throw new Error(`No offerItems found for item.offerId=${item.offerId}`);
        }

        for (const underlyingItem of underlyingItems) {
          const requiredQty = underlyingItem.bundleQty * item.qty;
          await decrementVariantStock(tx, underlyingItem.variantId, requiredQty);
        }
      } else {
        if (item.itemType === "collection") {
          if (item.collectionId == null) {
            throw new Error("Order item.itemType=collection requires non-null item.collectionId before querying collectionItems");
          }

          const underlyingItems = await tx
            .select({
              variantId: collectionItems.variantId,
              bundleQty: collectionItems.qty
            })
            .from(collectionItems)
            .where(eq(collectionItems.collectionId, item.collectionId));

          if (underlyingItems.length === 0) {
            throw new Error(`No collectionItems found for item.collectionId=${item.collectionId}`);
          }

          for (const underlyingItem of underlyingItems) {
            const requiredQty = underlyingItem.bundleQty * item.qty;
            await decrementVariantStock(tx, underlyingItem.variantId, requiredQty);
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
      totalAmount: sql`${input.order.totalAmount}`,
      erpManualTotalAmount: input.order.erpManualTotalAmount == null ? null : sql`${input.order.erpManualTotalAmount}`
    }).$returningId();

    const now = new Date();
    const dayPrefix = [
      input.orderCodeChannel,
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
    const [counterRow] = await tx
      .select({ value: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.orderCode} like ${`${dayPrefix}-%`}`);
    const orderCode = formatDailyOrderCode(input.orderCodeChannel, now, Number(counterRow?.value ?? 0) + 1);

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
        snapshotSizeLabel: item.snapshotSizeLabel ?? null
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
      .select({ paymentStatus: orders.paymentStatus })
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
