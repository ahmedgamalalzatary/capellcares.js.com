import { EG_PHONE_REGEX, GOVERNORATES } from "@capella/shared/constants";
import { createOrderFromCheckout } from "../orders/orders.service.js";
import type { CheckoutPayload } from "../../types/domain.js";

function validateCheckoutPayload(payload: CheckoutPayload) {
  const requiredFields: Array<keyof CheckoutPayload> = [
    "fullName",
    "phone",
    "email",
    "governorate",
    "cityArea",
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
  if (!EG_PHONE_REGEX.test(payload.phone)) throw new Error("Invalid Egyptian phone number");
  if (!GOVERNORATES.includes(payload.governorate as (typeof GOVERNORATES)[number])) {
    throw new Error("Invalid governorate");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("At least one item is required");
}

export async function submitCheckout(payload: CheckoutPayload, options: { idempotencyKey?: string } = {}) {
  validateCheckoutPayload(payload);
  if (!options.idempotencyKey?.trim()) {
    throw new Error("Idempotency-Key header is required for checkout");
  }
  return createOrderFromCheckout(payload, { idempotencyKey: options.idempotencyKey.trim() });
}
