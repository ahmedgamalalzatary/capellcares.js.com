import { createOrderFromCheckout } from "../orders/orders.service.js";
import type { CheckoutPayload } from "../../types/domain.js";

const egyptPhonePattern = /^(?:\+20|0)?1[0-2,5]\d{8}$/;

export function validateCheckoutPayload(payload: CheckoutPayload) {
  const requiredFields: Array<keyof CheckoutPayload> = [
    "fullName",
    "phone",
    "email",
    "governorate",
    "cityArea",
    "addressLine",
    "buildingApartment",
    "notes",
    "paymentMethod",
    "items"
  ];

  for (const field of requiredFields) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Field is required: ${field}`);
    }
  }
  if (!egyptPhonePattern.test(payload.phone)) throw new Error("Invalid Egyptian phone number");
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("At least one item is required");
}

export async function submitCheckout(payload: CheckoutPayload) {
  validateCheckoutPayload(payload);
  return createOrderFromCheckout(payload);
}
