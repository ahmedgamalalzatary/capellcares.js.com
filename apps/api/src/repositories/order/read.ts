import { db } from "@capella/database/src/db";
import { collectionItems, offerItems, orderItems, orders, productVariants, products } from "@capella/database/drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  mergeProductTotal,
  mergeVariantTotal,
  toNumber
} from "./shared.js";

export async function listOrdersRepo(filters?: { customerId?: number; withItems?: boolean }) {
  const rows = await db
    .select()
    .from(orders)
    .where(filters?.customerId != null ? eq(orders.customerId, filters.customerId) : undefined)
    .orderBy(desc(orders.createdAt));

  const summaries = rows.map((row) => ({
    ...row,
    totalAmount: toNumber(row.totalAmount)
  }));

  // The admin list only needs order-level columns. The storefront list renders a
  // card per order with item thumbnails and a unit count, so it opts into the
  // line items via one extra query rather than N per-order detail requests.
  if (!filters?.withItems || summaries.length === 0) {
    return summaries;
  }

  const rawItems = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, summaries.map((row) => row.id)));

  const itemsByOrder = new Map<number, typeof rawItems>();
  for (const item of rawItems) {
    const bucket = itemsByOrder.get(item.orderId);
    if (bucket) bucket.push(item);
    else itemsByOrder.set(item.orderId, [item]);
  }

  return summaries.map((row) => ({
    ...row,
    items: (itemsByOrder.get(row.id) ?? []).map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal)
    }))
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
      lineTotal: toNumber(item.lineTotal),
      snapshotBaseUnitPrice: item.snapshotBaseUnitPrice == null ? null : toNumber(item.snapshotBaseUnitPrice),
      snapshotDiscountValue: item.snapshotDiscountValue == null ? null : toNumber(item.snapshotDiscountValue),
      snapshotDiscountStartsAt: item.snapshotDiscountStartsAt?.toISOString() ?? null,
      snapshotDiscountEndsAt: item.snapshotDiscountEndsAt?.toISOString() ?? null
    }))
  };
}

export async function getSalesAnalyticsRepo() {
  const allOrderRows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const orderRows = allOrderRows.filter((order) =>
    order.paymentMethod === "cod"
      ? order.paymentStatus === "accepted"
      : order.paymentStatus !== "denied" &&
        (order.providerPaymentStatus === "succeeded" || order.providerPaymentStatus === "partially_refunded")
  );
  const itemRows = await db.select().from(orderItems).orderBy(desc(orderItems.orderId));
  const recognizedCentsByOrder = new Map(orderRows.map((order) => [order.id,
    Math.max(0, Math.round(toNumber(order.totalAmount) * 100) -
      (order.paymentMethod === "paymob" ? order.refundedAmountCents : 0))]));
  const lineRevenueCents = new Map<number, number>();
  for (const order of orderRows) {
    const lines = itemRows.filter((item) => item.orderId === order.id);
    const grossCents = Math.round(toNumber(order.totalAmount) * 100);
    const netCents = recognizedCentsByOrder.get(order.id) ?? 0;
    let allocated = 0;
    lines.forEach((line, index) => {
      const amount = index === lines.length - 1 ? netCents - allocated :
        grossCents > 0 ? Math.round(Math.round(toNumber(line.lineTotal) * 100) * netCents / grossCents) : 0;
      lineRevenueCents.set(line.id, amount);
      allocated += amount;
    });
  }
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
  const collectionItemRows = await db.select().from(collectionItems);

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
  const collectionItemsByCollectionId = new Map<number, Array<{ variantId: number; qty: number }>>();
  for (const row of collectionItemRows) {
    const items = collectionItemsByCollectionId.get(row.collectionId) ?? [];
    items.push({ variantId: row.variantId, qty: row.qty });
    collectionItemsByCollectionId.set(row.collectionId, items);
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
      totalAmount: (recognizedCentsByOrder.get(order.id) ?? 0) / 100,
      unitsSold: 0,
      createdAt: order.createdAt.toISOString(),
      items: []
    });
    totalRevenue += (recognizedCentsByOrder.get(order.id) ?? 0) / 100;
  }

  for (const item of itemRows) {
    const orderBreakdown = orderBreakdowns.get(item.orderId);
    if (!orderBreakdown) {
      continue;
    }

    if (item.itemType === "offer" || item.itemType === "collection") {
      const expandedItems: Array<{ variantId: number; qty: number; unitPrice?: number }> = item.snapshotComponents
        ? JSON.parse(item.snapshotComponents) as Array<{ variantId: number; qty: number; unitPrice?: number }>
        : item.itemType === "offer"
          ? offerItemsByOfferId.get(item.offerId ?? -1) ?? []
          : collectionItemsByCollectionId.get(item.collectionId ?? -1) ?? [];
      // Allocate the offer line's actual paid total (lineTotal) across its component
      // variants in proportion to each component's catalog value, so component revenue
      // reconciles with totalRevenue instead of using the standalone catalog price.
      const components = expandedItems.flatMap((expandedItem) => {
        const variant = variantById.get(expandedItem.variantId);
        if (!variant) {
          return [];
        }
        const unitsSold = expandedItem.qty * item.qty;
        return [{ variant, unitsSold, weight: (expandedItem.unitPrice ?? variant.defaultUnitPrice) * unitsSold }];
      });
      const paidCents = lineRevenueCents.get(item.id) ?? 0;
      const weightSum = components.reduce((sum, component) => sum + component.weight, 0);
      let allocatedCents = 0;
      for (const [index, { variant, unitsSold, weight }] of components.entries()) {
        const componentCents = index === components.length - 1 ? paidCents - allocatedCents
          : Math.round(paidCents * (weightSum > 0 ? weight / weightSum : 1 / components.length));
        allocatedCents += componentCents;
        const revenue = componentCents / 100;
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
    const revenue = (lineRevenueCents.get(item.id) ?? 0) / 100;
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
