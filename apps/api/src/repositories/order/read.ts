import { db } from "@minikoshk/database/src/db";
import { offerItems, orderItems, orders, productVariants, products } from "@minikoshk/database/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  mergeProductTotal,
  mergeVariantTotal,
  toNumber
} from "./shared.js";

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
      // Allocate the offer line's actual paid total (lineTotal) across its component
      // variants in proportion to each component's catalog value, so component revenue
      // reconciles with totalRevenue instead of using the standalone catalog price.
      const components = expandedItems.flatMap((expandedItem) => {
        const variant = variantById.get(expandedItem.variantId);
        if (!variant) {
          return [];
        }
        const unitsSold = expandedItem.qty * item.qty;
        return [{ variant, unitsSold, weight: variant.defaultUnitPrice * unitsSold }];
      });
      const paidTotal = toNumber(item.lineTotal);
      const weightSum = components.reduce((sum, component) => sum + component.weight, 0);
      for (const { variant, unitsSold, weight } of components) {
        const revenue = weightSum > 0
          ? paidTotal * (weight / weightSum)
          : paidTotal / components.length;
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
