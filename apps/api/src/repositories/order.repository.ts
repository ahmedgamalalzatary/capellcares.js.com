import { db } from "@capella/database/src/db";
import { offerItems, orderItems, orders, productVariants, products } from "@capella/database/drizzle/schema";
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

export async function getSalesAnalyticsRepo() {
  const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const itemRows = await db.select().from(orderItems).orderBy(desc(orderItems.orderId));
  const variantRows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      variantLabel: productVariants.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      productName: products.enName
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId));
  const offerItemRows = await db.select().from(offerItems);

  const variantById = new Map(
    variantRows.map((row) => [
      row.variantId,
      {
        variantId: row.variantId,
        productId: row.productId,
        variantLabel: row.variantLabel,
        productName: row.productName,
        defaultUnitPrice: toNumber(row.sellingPrice)
      }
    ])
  );
  const offerItemsByOfferId = new Map<number, Array<{ variantId: number; qty: number }>>();
  for (const row of offerItemRows) {
    const items = offerItemsByOfferId.get(row.offerId) ?? [];
    items.push({ variantId: row.variantId, qty: row.qty });
    offerItemsByOfferId.set(row.offerId, items);
  }

  const productTotals = new Map<number, { productId: number; productName: string; unitsSold: number; revenue: number }>();
  const variantTotals = new Map<number, { variantId: number; productId: number; productName: string; variantLabel: string; unitsSold: number; revenue: number }>();
  const orderBreakdowns = new Map<number, {
    orderId: number;
    orderCode: string;
    paymentStatus: string;
    totalAmount: number;
    unitsSold: number;
    createdAt: string;
    items: Array<{ label: string; unitsSold: number }>;
  }>();

  let totalUnitsSold = 0;
  let totalRevenue = 0;

  for (const order of orderRows) {
    orderBreakdowns.set(order.id, {
      orderId: order.id,
      orderCode: order.orderCode,
      paymentStatus: order.paymentStatus,
      totalAmount: toNumber(order.totalAmount),
      unitsSold: 0,
      createdAt: order.createdAt.toISOString(),
      items: []
    });
    totalRevenue += toNumber(order.totalAmount);
  }

  for (const item of itemRows) {
    const orderBreakdown = orderBreakdowns.get(item.orderId);
    if (!orderBreakdown) {
      continue;
    }

    if (item.itemType === "offer") {
      const expandedItems = offerItemsByOfferId.get(item.offerId ?? -1) ?? [];
      for (const expandedItem of expandedItems) {
        const variant = variantById.get(expandedItem.variantId);
        if (!variant) {
          continue;
        }
        const unitsSold = expandedItem.qty * item.qty;
        const revenue = variant.defaultUnitPrice * unitsSold;
        const label = `${variant.productName} / ${variant.variantLabel}`;
        totalUnitsSold += unitsSold;
        orderBreakdown.unitsSold += unitsSold;
        orderBreakdown.items.push({ label, unitsSold });
        mergeProductTotal(productTotals, variant.productId, variant.productName, unitsSold, revenue);
        mergeVariantTotal(variantTotals, variant.variantId, variant.productId, variant.productName, variant.variantLabel, unitsSold, revenue);
      }
      continue;
    }

    if (item.variantId == null) {
      continue;
    }

    const variant = variantById.get(item.variantId);
    if (!variant) {
      continue;
    }
    const unitsSold = item.qty;
    const revenue = toNumber(item.lineTotal);
    const label = `${variant.productName} / ${variant.variantLabel}`;
    totalUnitsSold += unitsSold;
    orderBreakdown.unitsSold += unitsSold;
    orderBreakdown.items.push({ label, unitsSold });
    mergeProductTotal(productTotals, variant.productId, variant.productName, unitsSold, revenue);
    mergeVariantTotal(variantTotals, variant.variantId, variant.productId, variant.productName, variant.variantLabel, unitsSold, revenue);
  }

  return {
    summary: {
      totalOrders: orderRows.length,
      totalUnitsSold,
      totalRevenue
    },
    productTotals: [...productTotals.values()].sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue),
    variantTotals: [...variantTotals.values()].sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue),
    orders: [...orderBreakdowns.values()]
  };
}

function mergeProductTotal(
  totals: Map<number, { productId: number; productName: string; unitsSold: number; revenue: number }>,
  productId: number,
  productName: string,
  unitsSold: number,
  revenue: number
) {
  const current = totals.get(productId) ?? { productId, productName, unitsSold: 0, revenue: 0 };
  current.unitsSold += unitsSold;
  current.revenue += revenue;
  totals.set(productId, current);
}

function mergeVariantTotal(
  totals: Map<number, { variantId: number; productId: number; productName: string; variantLabel: string; unitsSold: number; revenue: number }>,
  variantId: number,
  productId: number,
  productName: string,
  variantLabel: string,
  unitsSold: number,
  revenue: number
) {
  const current = totals.get(variantId) ?? {
    variantId,
    productId,
    productName,
    variantLabel,
    unitsSold: 0,
    revenue: 0
  };
  current.unitsSold += unitsSold;
  current.revenue += revenue;
  totals.set(variantId, current);
}
