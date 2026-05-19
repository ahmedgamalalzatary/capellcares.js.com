import { db } from "@capella/database/src/db";
import { offerItems, orderItems, orders, productVariants } from "@capella/database/drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const allowedPaymentStatuses = new Set(["pending", "accepted", "denied"]);

function generateOrderCode(orderId: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let seed = orderId * 7919 + 104729;
  let letters = "";
  for (let index = 0; index < 4; index += 1) {
    letters += alphabet[seed % alphabet.length];
    seed = Math.floor(seed / alphabet.length);
  }
  return `${letters}-${String(orderId).padStart(3, "0")}`;
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
  items: Array<{ variantId: number; qty: number; unitPrice: number; lineTotal: number }>;
}) {
  return db.transaction(async (tx) => {
    for (const item of input.items) {
      if ((item as any).itemType === "offer") {
        const underlyingItems = await tx
          .select({
            variantId: offerItems.variantId,
            bundleQty: offerItems.qty,
            stockQty: productVariants.stockQty
          })
          .from(offerItems)
          .innerJoin(productVariants, eq(productVariants.id, offerItems.variantId))
          .where(eq(offerItems.offerId, (item as any).offerId));

        for (const underlyingItem of underlyingItems) {
          const requiredQty = underlyingItem.bundleQty * item.qty;
          if (underlyingItem.stockQty < requiredQty) {
            throw new Error("Insufficient stock");
          }
          await tx
            .update(productVariants)
            .set({ stockQty: sql`${productVariants.stockQty} - ${requiredQty}` })
            .where(eq(productVariants.id, underlyingItem.variantId));
        }
      } else {
        const [variant] = await tx
          .select({ stockQty: productVariants.stockQty })
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .limit(1);
        if (!variant || variant.stockQty < item.qty) throw new Error("Insufficient stock");
        await tx
          .update(productVariants)
          .set({ stockQty: sql`${productVariants.stockQty} - ${item.qty}` })
          .where(eq(productVariants.id, item.variantId));
      }
    }

    const [order] = await tx.insert(orders).values({
      ...input.order,
      orderCode: "",
      totalAmount: sql`${input.order.totalAmount}`
    }).$returningId();

    const orderCode = generateOrderCode(order.id);

    await tx
      .update(orders)
      .set({ orderCode })
      .where(eq(orders.id, order.id));

    await tx.insert(orderItems).values(
      input.items.map((i) => ({
        orderId: order.id,
        itemType: (i as any).itemType ?? "product_variant",
        variantId: (i as any).variantId ?? null,
        offerId: (i as any).offerId ?? null,
        qty: i.qty,
        unitPrice: sql`${i.unitPrice}`,
        lineTotal: sql`${i.lineTotal}`,
        snapshotNameAr: (i as any).snapshotNameAr ?? null,
        snapshotNameEn: (i as any).snapshotNameEn ?? null,
        snapshotSizeLabel: (i as any).snapshotSizeLabel ?? null
      }))
    );
    return { id: order.id, orderCode };
  });
}

function toNumber(value: unknown) {
  if (value == null) {
    return 0;
  }

  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new TypeError(`toNumber could not coerce value: ${String(value)}`);
  }

  return result;
}

export async function listOrdersRepo(filters?: { customerId?: number }) {
  const rows = await db
    .select()
    .from(orders)
    .where(filters?.customerId != null ? eq(orders.customerId, filters.customerId) : undefined)
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => ({
    ...row,
    totalAmount: toNumber(row.totalAmount)
  }));
}

export async function findOrderByIdRepo(id: number, filters?: { customerId?: number }) {
  const [order] = await db
    .select()
    .from(orders)
    .where(
      filters?.customerId != null
        ? and(eq(orders.id, id), eq(orders.customerId, filters.customerId))
        : eq(orders.id, id)
    )
    .limit(1);

  if (!order) {
    return null;
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return {
    ...order,
    totalAmount: toNumber(order.totalAmount),
    items: items.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal)
    }))
  };
}

export async function updateOrderPaymentStatusRepo(
  id: number,
  paymentStatus: "pending" | "accepted" | "denied"
) {
  if (!allowedPaymentStatuses.has(paymentStatus)) {
    throw new Error(`updateOrderPaymentStatusRepo received invalid paymentStatus: ${String(paymentStatus)}`);
  }
  await db.update(orders).set({ paymentStatus }).where(eq(orders.id, id));
}
