import { KW_PHONE_REGEX } from "@capella/shared/constants";
import type { CheckoutQuoteDto } from "@capella/shared/dto";
import { createOrderFromCheckout, quoteCheckout } from "../orders/orders.service.js";
import type { CheckoutPayload } from "../../types/domain.js";

function validateCheckoutPayload(payload: CheckoutPayload) {
  const requiredFields: Array<keyof CheckoutPayload> = [
    "fullName",
    "phone",
    "email",
    "areaId",
    "addressLine",
    "buildingApartment",
    "items"
  ];

  for (const field of requiredFields) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Field is required: ${field}`);
    }
  }
  if (!KW_PHONE_REGEX.test(payload.phone)) throw new Error("Invalid Kuwaiti phone number");
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("At least one item is required");
}

export async function submitCheckout(payload: CheckoutPayload, options: { idempotencyKey?: string } = {}) {
  validateCheckoutPayload(payload);
  if (!options.idempotencyKey?.trim()) {
    throw new Error("Idempotency-Key header is required for checkout");
  }
  return createOrderFromCheckout(payload, { idempotencyKey: options.idempotencyKey.trim() });
}

/** Checkout's live price box: subtotal, delivery fee and total for the chosen area, with the promo code applied when there is one. */
export async function quoteCheckoutTotals(
  payload: Pick<CheckoutPayload, "areaId" | "items"> & Partial<Pick<CheckoutPayload, "promoCode" | "phone" | "customerId">>
): Promise<CheckoutQuoteDto> {
  const { priced, subtotal, deliveryFee, deliveryFeeWaived, total } = await quoteCheckout(payload);
  // Without a code the answer is exactly what it was before promo codes, so older apps read it unchanged.
  if (!payload.promoCode) return { subtotal, deliveryFee, total };
  return {
    subtotal,
    deliveryFee,
    total,
    deliveryFeeWaived,
    items: pricedLines(priced.items),
    promo: priced.promo?.dto ?? null
  };
}

/** Every priced line as the storefront shows it: what is paid, and the original price the code worked from. */
export function pricedLines(items: Array<{ unitPrice: number; lineTotal: number; snapshotBaseUnitPrice: number | null; promoDiscountAmount?: number | null }>) {
  return items.map((item, index) => ({
    index,
    unitPrice: item.unitPrice,
    originalUnitPrice: item.snapshotBaseUnitPrice ?? item.unitPrice,
    lineTotal: item.lineTotal,
    promoDiscount: item.promoDiscountAmount ?? 0
  }));
}
