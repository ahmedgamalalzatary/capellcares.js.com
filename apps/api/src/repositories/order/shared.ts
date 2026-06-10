import { randomUUID } from "node:crypto";

export const allowedPaymentStatuses = new Set(["pending", "accepted", "denied"]);

export function generateOrderCode(orderId: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let seed = orderId * 7919 + 104729;
  let letters = "";
  for (let index = 0; index < 4; index += 1) {
    letters += alphabet[seed % alphabet.length];
    seed = Math.floor(seed / alphabet.length);
  }
  return `${letters}-${String(orderId).padStart(3, "0")}`;
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
