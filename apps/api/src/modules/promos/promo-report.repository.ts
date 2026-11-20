// The report for one promo code (docs/promo-codes-spec.md section 9.3) and the dashboard's promo items. Every number is built
// from the orders that used the code and their redemptions, so each one can be checked against those orders.
// Money is in fils (thousandths of a dinar).
import { and, asc, desc, eq, gt, inArray, isNotNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orderItems, orders, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";

const fils = (value: string | number) => Math.round(Number(value) * 1000);
const kuwaitDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait", year: "numeric", month: "2-digit", day: "2-digit" });

export async function getPromoCodeReportRepo(id: number) {
  const [code] = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  if (!code) return null;
  const [redemptions, codeOrders] = await Promise.all([
    db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, id)),
    db.select().from(orders).where(eq(orders.promoCodeId, id)).orderBy(desc(orders.createdAt), desc(orders.id))
  ]);
  const useByOrder = new Map(redemptions.filter((use) => use.orderId !== null).map((use) => [use.orderId!, use]));
  // Money and customers count only orders still using the code; a denied, cancelled or expired order gave its use back.
  const live = codeOrders.filter((order) => useByOrder.get(order.id)?.state === "used");
  const liveIds = live.map((order) => order.id);
  const gifts = liveIds.length === 0 ? [] : await db.select({ qty: orderItems.qty, base: orderItems.snapshotBaseUnitPrice }).from(orderItems)
    .where(and(inArray(orderItems.orderId, liveIds), eq(orderItems.isPromoGift, true)));

  const used = redemptions.filter((use) => use.state === "used").length;
  const liveTotal = live.reduce((sum, order) => sum + fils(order.totalAmount), 0);
  const [store] = await db.select({ total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`, orders: sql<number>`count(*)` })
    .from(orders).where(ne(orders.paymentStatus, "denied"));
  const storeOrders = Number(store?.orders ?? 0);

  // A customer is new when this order with the code was their first order of any kind (by account or phone).
  let newCustomers = 0;
  let returningCustomers = 0;
  const firstLiveByCustomer = new Map<string, (typeof live)[number]>();
  for (const order of [...live].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)) {
    const key = order.customerId !== null ? `c${order.customerId}` : `p${order.phone}`;
    if (!firstLiveByCustomer.has(key)) firstLiveByCustomer.set(key, order);
  }
  for (const order of firstLiveByCustomer.values()) {
    const sameCustomer = order.customerId !== null ? or(eq(orders.customerId, order.customerId), eq(orders.phone, order.phone)) : eq(orders.phone, order.phone);
    const [earlier] = await db.select({ id: orders.id }).from(orders)
      .where(and(sameCustomer, ne(orders.id, order.id), or(lt(orders.createdAt, order.createdAt), and(eq(orders.createdAt, order.createdAt), lt(orders.id, order.id)))))
      .limit(1);
    if (earlier) returningCustomers += 1;
    else newCustomers += 1;
  }

  const byCustomerMap = new Map<string, { customerId: number | null; name: string; phone: string; uses: number; orders: number; spentFils: number }>();
  for (const order of codeOrders) {
    const key = order.customerId !== null ? `c${order.customerId}` : `p${order.phone}`;
    const row = byCustomerMap.get(key) ?? { customerId: order.customerId, name: order.fullName, phone: order.phone, uses: 0, orders: 0, spentFils: 0 };
    row.orders += 1;
    if (useByOrder.get(order.id)?.state === "used") {
      row.uses += 1;
      row.spentFils += fils(order.totalAmount);
    }
    byCustomerMap.set(key, row);
  }

  const usageByDay = new Map<string, number>();
  for (const order of live) usageByDay.set(kuwaitDay.format(order.createdAt), (usageByDay.get(kuwaitDay.format(order.createdAt)) ?? 0) + 1);

  return {
    uses: {
      used,
      released: redemptions.filter((use) => use.state === "released").length,
      remaining: code.totalUsageLimit === null ? null : Math.max(0, code.totalUsageLimit - used)
    },
    money: {
      revenueFils: liveTotal,
      discountFils: live.reduce((sum, order) => sum + order.promoDiscountFils, 0),
      shippingAbsorbedFils: live.reduce((sum, order) => sum + order.promoShippingWaivedFils, 0),
      giftCostFils: gifts.reduce((sum, line) => sum + fils(line.base ?? 0) * line.qty, 0),
      saleGivenUpFils: live.reduce((sum, order) => {
        try {
          return sum + Number((JSON.parse(order.promoSnapshot ?? "{}") as { saleGivenUpFils?: number }).saleGivenUpFils ?? 0);
        } catch {
          return sum;
        }
      }, 0),
      averageOrderFils: live.length === 0 ? 0 : Math.round(liveTotal / live.length),
      storeAverageFils: storeOrders === 0 ? 0 : Math.round(fils(store!.total) / storeOrders)
    },
    customers: {
      newVsReturning: { newCustomers, returningCustomers },
      byCustomer: [...byCustomerMap.values()].sort((a, b) => b.uses - a.uses || b.spentFils - a.spentFils)
    },
    orders: codeOrders.map((order) => {
      const use = useByOrder.get(order.id);
      return {
        id: order.id, orderCode: order.orderCode, createdAt: order.createdAt.toISOString(), customerName: order.fullName,
        totalAmount: Number(order.totalAmount), paymentStatus: order.paymentStatus,
        useState: use?.state ?? null, releaseReason: use?.releaseReason ?? null
      };
    }),
    health: {
      cancelled: { count: codeOrders.filter((order) => useByOrder.get(order.id)?.state === "released").length, total: codeOrders.length },
      usageByDay: [...usageByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, uses]) => ({ date, uses }))
    }
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** For the dashboard: free orders a code made that staff have not reviewed yet, and running codes that end within a week. */
export async function getPromoAttentionRepo(now = new Date()) {
  const [freeOrderReviews, endingSoon] = await Promise.all([
    db.select({ orderId: orders.id, orderCode: orders.orderCode, codeText: orders.promoCodeText, createdAt: orders.createdAt })
      .from(orders).where(eq(orders.promoFreeReview, "open"))
      .orderBy(asc(orders.createdAt), asc(orders.id)),
    db.select({ id: promoCodes.id, code: promoCodes.code, arName: promoCodes.arName, endsAt: promoCodes.endsAt }).from(promoCodes)
      .where(and(eq(promoCodes.status, "active"), isNotNull(promoCodes.endsAt), gt(promoCodes.endsAt, now), lte(promoCodes.endsAt, new Date(now.getTime() + WEEK_MS))))
      .orderBy(asc(promoCodes.endsAt), asc(promoCodes.id))
  ]);
  return {
    freeOrderReviews: freeOrderReviews.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    endingSoon: endingSoon.map((row) => ({ ...row, endsAt: row.endsAt!.toISOString() }))
  };
}
