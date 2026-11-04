import { KW_PHONE_REGEX } from "@capella/shared/constants";
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

/** Checkout's live price box: subtotal, delivery fee and total for the chosen area. */
export async function quoteCheckoutTotals(payload: Pick<CheckoutPayload, "areaId" | "items">) {
  const { subtotal, deliveryFee, total } = await quoteCheckout(payload);
  return { subtotal, deliveryFee, total };
}
