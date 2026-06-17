import { randomUUID } from "node:crypto";

export const allowedPaymentStatuses = new Set(["pending", "accepted", "denied"]);
export type OrderCodeChannel = "WEB" | "ERP";

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDailyOrderCode(channel: OrderCodeChannel, createdAt: Date, dailyCounter: number): string {
  return [
    channel,
    createdAt.getFullYear(),
    padDatePart(createdAt.getMonth() + 1),
    padDatePart(createdAt.getDate()),
    padDatePart(createdAt.getHours()),
    padDatePart(createdAt.getMinutes()),
    dailyCounter
  ].join("-");
}

export function generatePendingOrderCode(): string {
  return `PEND-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export function toNumber(value: unknown) {
  if (value == null) {
    return 0;
  }

  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new TypeError(`toNumber could not coerce value: ${String(value)}`);
  }

  return result;
}

export function mergeProductTotal(
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

export function mergeVariantTotal(
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
