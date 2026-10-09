import type { Offer, OrderSummary, Product, ProductVariant, VariantDiscount } from "@capella/shared";
import { orderMatchesPaymentStatusFilter } from "./payment-status";
import type { SalesAnalytics } from "./store/types";

export type DashboardRange = "today" | "7d" | "30d";
type SaleOrder = SalesAnalytics["orders"][number];

const DAY_MS = 24 * 60 * 60 * 1000;
const rangeDays: Record<DashboardRange, number> = { today: 1, "7d": 7, "30d": 30 };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Local-time window for a range: it ends now and starts at midnight `days - 1` days ago; the previous window is the same number of days right before it. */
export function rangeWindow(range: DashboardRange, now: Date) {
  const days = rangeDays[range];
  const start = addDays(startOfDay(now), -(days - 1));
  return { days, start, previousStart: addDays(start, -days), end: now };
}

/** Revenue, order count and units for the range, a chart series (hours for today, days otherwise) and the change against the previous window. */
export function salesPulse(orders: SaleOrder[], range: DashboardRange, now: Date) {
  const { days, start, previousStart, end } = rangeWindow(range, now);
  const series = new Array<number>(range === "today" ? 24 : days).fill(0);
  let revenue = 0;
  let previousRevenue = 0;
  let orderCount = 0;
  let units = 0;

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    if (createdAt > end || createdAt < previousStart) continue;
    if (createdAt < start) {
      previousRevenue += order.totalAmount;
      continue;
    }
    revenue += order.totalAmount;
    orderCount += 1;
    units += order.unitsSold;
    // Rounding absorbs a daylight-saving hour between the two midnights.
    const index = range === "today" ? createdAt.getHours() : Math.round((startOfDay(createdAt).getTime() - start.getTime()) / DAY_MS);
    series[index] += order.totalAmount;
  }

  return {
    revenue,
    previousRevenue,
    change: previousRevenue > 0 ? (revenue - previousRevenue) / previousRevenue : null,
    orderCount,
    units,
    averageOrder: orderCount > 0 ? revenue / orderCount : 0,
    series
  };
}

/** Orders by payment outcome, read the same way as the orders list filter (Paymob by the provider's status, cash on delivery by the staff-set status). */
export function paymentSplit(orders: OrderSummary[], since: Date | null) {
  const split = { accepted: 0, pending: 0, denied: 0 };
  for (const order of orders) {
    if (since && new Date(order.createdAt) < since) continue;
    for (const status of ["accepted", "pending", "denied"] as const) {
      if (orderMatchesPaymentStatusFilter(order, status)) split[status] += 1;
    }
  }
  return split;
}

/** Units sold per product since `since`, most first, named in Arabic from the catalog (or by the sold label once the product is gone). */
export function topSellers(orders: SaleOrder[], since: Date, products: Product[], limit: number) {
  const byId = new Map<number, { productId: number; name: string; units: number }>();
  for (const order of orders) {
    if (new Date(order.createdAt) < since) continue;
    for (const item of order.items) {
      const entry = byId.get(item.productId);
      if (entry) {
        entry.units += item.unitsSold;
        continue;
      }
      const name = products.find((product) => product.id === item.productId)?.name.ar || item.label.split(" / ")[0];
      byId.set(item.productId, { productId: item.productId, name, units: item.unitsSold });
    }
  }
  return [...byId.values()].sort((a, b) => b.units - a.units).slice(0, limit);
}

/** Active, in-stock products that sold nothing in the last `days` days; products added inside that window are too new to judge. */
export function slowMovers(products: Product[], orders: SaleOrder[], now: Date, days: number) {
  const since = addDays(startOfDay(now), -(days - 1));
  const sold = new Set(orders
    .filter((order) => new Date(order.createdAt) >= since)
    .flatMap((order) => order.items.map((item) => item.productId)));
  return products.filter((product) =>
    !product.deletedAt &&
    product.status === "active" &&
    new Date(product.createdAt) < since &&
    product.variants.some((variant) => variant.stock > 0) &&
    !sold.has(product.id));
}

export const LOW_STOCK_LIMIT = 5;

/** Sizes that ran out or have at most LOW_STOCK_LIMIT left, ordered by units sold in the last `days` days so a best seller running out comes first. */
export function stockAlerts(products: Product[], orders: SaleOrder[], now: Date, days: number) {
  const since = addDays(startOfDay(now), -(days - 1));
  const soldByVariant = new Map<number, number>();
  for (const order of orders) {
    if (new Date(order.createdAt) < since) continue;
    for (const item of order.items) soldByVariant.set(item.variantId, (soldByVariant.get(item.variantId) ?? 0) + item.unitsSold);
  }
  return products
    .filter((product) => !product.deletedAt)
    .flatMap((product) => product.variants
      .filter((variant) => variant.stock <= LOW_STOCK_LIMIT)
      .map((variant) => ({
        product,
        variant,
        level: variant.stock <= 0 ? "out" as const : "low" as const,
        sold: soldByVariant.get(variant.id) ?? 0
      })))
    .sort((a, b) => b.sold - a.sold || a.variant.stock - b.variant.stock);
}

type Discounted = Pick<Offer, "id" | "name" | "discount" | "deletedAt">;

/** Running discounts (on, started, not over) that end within `days` days, soonest first. A product shows once, with its size that ends first. */
export function endingDiscounts(catalog: { products: Product[]; offers: Discounted[]; collections: Discounted[] }, now: Date, days: number) {
  const horizon = now.getTime() + days * DAY_MS;
  const endsSoon = (discount: VariantDiscount | null | undefined): discount is VariantDiscount => {
    if (!discount || discount.status !== "active") return false;
    const endsAt = new Date(discount.endsAt).getTime();
    return new Date(discount.startsAt).getTime() <= now.getTime() && endsAt > now.getTime() && endsAt <= horizon;
  };
  const rows: Array<{ key: string; name: string; endsAt: string; href: string }> = [];

  for (const product of catalog.products) {
    if (product.deletedAt) continue;
    const ends = product.variants.map((variant) => variant.discount).filter(endsSoon)
      .map((discount) => discount.endsAt)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    if (ends[0]) rows.push({ key: `product-${product.id}`, name: product.name.ar, endsAt: ends[0], href: `/products/${product.id}/discount` });
  }
  for (const [kind, items] of [["offer", catalog.offers], ["collection", catalog.collections]] as const) {
    for (const item of items) {
      if (item.deletedAt || !endsSoon(item.discount)) continue;
      rows.push({ key: `${kind}-${item.id}`, name: item.name.ar, endsAt: item.discount.endsAt, href: `/${kind}s/${item.id}/edit` });
    }
  }
  return rows.sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
}

const healthChecks = {
  image: (product: Product) => Boolean(product.imagePath) ||
    (product.media ?? []).some((media) => media.type === "image" && Boolean(media.arUrl || media.enUrl)),
  englishName: (product: Product) => Boolean(product.name.en?.trim()),
  description: (product: Product) => Boolean(product.description.ar?.trim() && product.description.en?.trim()),
  keywords: (product: Product) => product.keywords.length > 0
};
export type HealthCheck = keyof typeof healthChecks;

/** Products (not deleted) missing each storefront detail, and the share of all details that are filled, as a whole percentage. */
export function catalogHealth(products: Product[]) {
  const live = products.filter((product) => !product.deletedAt);
  const checks = Object.keys(healthChecks) as HealthCheck[];
  const missing = Object.fromEntries(checks.map((check) => [check, live.filter((product) => !healthChecks[check](product))])) as Record<HealthCheck, Product[]>;
  const gaps = checks.reduce((sum, check) => sum + missing[check].length, 0);
  const total = live.length * checks.length;
  return { score: total > 0 ? Math.round(((total - gaps) / total) * 100) : null, missing };
}

/** "يوم" / "يومين" / "3 أيام" / "11 يومًا": Arabic changes the noun with the count (Latin digits, as everywhere in the ERP). */
export function daysPhrase(days: number) {
  if (days === 1) return "يوم";
  if (days === 2) return "يومين";
  return days >= 3 && days <= 10 ? `${days} أيام` : `${days} يومًا`;
}
