// The report for one promo code (docs/promo-codes-spec.md section 9.3) and the dashboard's promo items. Every number is built
// from the orders that used the code and their redemptions, so each one can be checked against those orders.
import { and, asc, desc, eq, gt, inArray, isNotNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orderItems, orderReviewFlags, orders, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";

const cents = (value: string | number) => Math.round(Number(value) * 100);
const cairoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" });

/** Released for these reasons, the order itself fell through (as opposed to a payment that never finished). */
const ORDER_RELEASE_REASONS = new Set(["cancelled", "denied", "expired"]);

export async function getPromoCodeReportRepo(id: number) {
  const [code] = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  if (!code) return null;
  const [redemptions, codeOrders] = await Promise.all([
    db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, id)),
    db.select().from(orders).where(eq(orders.promoCodeId, id)).orderBy(desc(orders.createdAt), desc(orders.id))
  ]);
  const useByOrder = new Map(redemptions.filter((use) => use.orderId !== null).map((use) => [use.orderId!, use]));
  // Money and customers count only orders still using the code; a denied, expired or cancelled order gave its use back.
  const live = codeOrders.filter((order) => useByOrder.get(order.id)?.state === "used");
  const liveIds = live.map((order) => order.id);
  const gifts = liveIds.length === 0 ? [] : await db.select({ qty: orderItems.qty, base: orderItems.snapshotBaseUnitPrice }).from(orderItems)
    .where(and(inArray(orderItems.orderId, liveIds), eq(orderItems.isPromoGift, true)));

  const count = (state: "used" | "reserved" | "released") => redemptions.filter((use) => use.state === state).length;
  const used = count("used");
  const reserved = count("reserved");

  const liveTotal = live.reduce((sum, order) => sum + cents(order.totalAmount), 0);
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

  const byCustomerMap = new Map<string, { customerId: number | null; name: string; phone: string; uses: number; orders: number; spentCents: number }>();
  for (const order of codeOrders) {
    const key = order.customerId !== null ? `c${order.customerId}` : `p${order.phone}`;
    const row = byCustomerMap.get(key) ?? { customerId: order.customerId, name: order.fullName, phone: order.phone, uses: 0, orders: 0, spentCents: 0 };
    row.orders += 1;
    if (useByOrder.get(order.id)?.state === "used") {
      row.uses += 1;
      row.spentCents += cents(order.totalAmount) - order.refundedAmountCents;
    }
    byCustomerMap.set(key, row);
  }

  const usageByDay = new Map<string, number>();
  for (const order of live) usageByDay.set(cairoDay.format(order.createdAt), (usageByDay.get(cairoDay.format(order.createdAt)) ?? 0) + 1);

  return {
    uses: {
      used,
      reserved,
      released: count("released"),
      overLimit: redemptions.filter((use) => use.overLimit).length,
      remaining: code.totalUsageLimit === null ? null : Math.max(0, code.totalUsageLimit - used - reserved)
    },
    money: {
      revenueCents: live.reduce((sum, order) => sum + cents(order.totalAmount) - order.refundedAmountCents, 0),
      discountCents: live.reduce((sum, order) => sum + order.promoDiscountCents, 0),
      shippingAbsorbedCents: live.reduce((sum, order) => sum + order.promoShippingWaivedCents, 0),
      giftCostCents: gifts.reduce((sum, line) => sum + cents(line.base ?? 0) * line.qty, 0),
      saleGivenUpCents: live.reduce((sum, order) => {
        try {
          return sum + Number((JSON.parse(order.promoSnapshot ?? "{}") as { saleGivenUpCents?: number }).saleGivenUpCents ?? 0);
        } catch {
          return sum;
        }
      }, 0),
      averageOrderCents: live.length === 0 ? 0 : Math.round(liveTotal / live.length),
      storeAverageCents: storeOrders === 0 ? 0 : Math.round(cents(store!.total) / storeOrders)
    },
    customers: {
      newVsReturning: { newCustomers, returningCustomers },
      byCustomer: [...byCustomerMap.values()].sort((a, b) => b.uses - a.uses || b.spentCents - a.spentCents)
    },
    orders: codeOrders.map((order) => {
      const use = useByOrder.get(order.id);
      return {
        id: order.id, orderCode: order.orderCode, createdAt: order.createdAt.toISOString(), customerName: order.fullName,
        totalAmount: Number(order.totalAmount), paymentStatus: order.paymentStatus, refundedAmountCents: order.refundedAmountCents,
        useState: use?.state ?? null, releaseReason: use?.releaseReason ?? null, overLimit: use?.overLimit ?? false
      };
    }),
    health: {
      cancelled: { count: codeOrders.filter((order) => ORDER_RELEASE_REASONS.has(useByOrder.get(order.id)?.releaseReason ?? "")).length, total: codeOrders.length },
      refunded: { count: codeOrders.filter((order) => order.refundedAmountCents > 0).length, total: codeOrders.length },
      usageByDay: [...usageByDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, uses]) => ({ date, uses }))
    }
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** For the dashboard: free orders a code made that staff have not reviewed yet, and running codes that end within a week. */
export async function getPromoAttentionRepo(now = new Date()) {
  const [freeOrderReviews, endingSoon] = await Promise.all([
    db.select({ orderId: orders.id, orderCode: orders.orderCode, codeText: orders.promoCodeText, createdAt: orderReviewFlags.createdAt })
      .from(orderReviewFlags).innerJoin(orders, eq(orders.id, orderReviewFlags.orderId))
      .where(and(eq(orderReviewFlags.flagType, "promo_free_review"), eq(orderReviewFlags.status, "open")))
      .orderBy(asc(orderReviewFlags.createdAt), asc(orderReviewFlags.id)),
    db.select({ id: promoCodes.id, code: promoCodes.code, arName: promoCodes.arName, endsAt: promoCodes.endsAt }).from(promoCodes)
      .where(and(eq(promoCodes.status, "active"), isNotNull(promoCodes.endsAt), gt(promoCodes.endsAt, now), lte(promoCodes.endsAt, new Date(now.getTime() + WEEK_MS))))
      .orderBy(asc(promoCodes.endsAt), asc(promoCodes.id))
  ]);
  return {
    freeOrderReviews: freeOrderReviews.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    endingSoon: endingSoon.map((row) => ({ ...row, endsAt: row.endsAt!.toISOString() }))
  };
}
