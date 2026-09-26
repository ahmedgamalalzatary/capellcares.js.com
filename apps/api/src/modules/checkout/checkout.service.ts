import { EG_PHONE_REGEX, GOVERNORATES } from "@capella/shared/constants";
import { createOrderFromCheckout, priceCheckout } from "../orders/orders.service.js";
import type { CheckoutPayload } from "../../types/domain.js";
import { resolvePaymobConfig } from "../payments/paymob/paymob-config.js";
import { initiatePaymobCheckout } from "./paymob-checkout.service.js";
import { resolveShippingForCheckout } from "../shipping/checkout-shipping-runtime.js";

export class PaymobUnavailableError extends Error {
  constructor() {
    super("Paymob checkout is not configured");
  }
}

function validateCheckoutPayload(payload: CheckoutPayload) {
  const requiredFields: Array<keyof CheckoutPayload> = [
    "fullName",
    "phone",
    "email",
    "governorate",
    "cityArea",
    "addressLine",
    "buildingApartment",
    "paymentMethod",
    "items"
  ];

  for (const field of requiredFields) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Field is required: ${field}`);
    }
  }
  if (!EG_PHONE_REGEX.test(payload.phone)) throw new Error("Invalid Egyptian phone number");
  if (!payload.shippingAddress && !GOVERNORATES.includes(payload.governorate as (typeof GOVERNORATES)[number])) {
    throw new Error("Invalid governorate");
  }
  if (payload.paymentMethod !== "cod" && payload.paymentMethod !== "paymob") {
    throw new Error("Unsupported payment method");
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("At least one item is required");
}

export async function submitCheckout(payload: CheckoutPayload, options: { idempotencyKey?: string } = {}) {
  validateCheckoutPayload(payload);
  if (!options.idempotencyKey?.trim()) {
    throw new Error("Idempotency-Key header is required for checkout");
  }
  if (payload.paymentMethod === "paymob") {
    const priced = await priceCheckout(payload);
    const shipping = await resolveShippingForCheckout(payload, priced);
    if (priced.totalAmount === 0 && (shipping?.shippingAmountCents ?? 0) === 0) {
      return { kind: "cod_order" as const, ...await createOrderFromCheckout(payload, {
        idempotencyKey: options.idempotencyKey.trim(), allowFreePrepaid: true
      }) };
    }
    const config = resolvePaymobConfig();
    const notificationUrl = process.env.PAYMOB_NOTIFICATION_URL?.trim();
    const redirectionUrl = process.env.PAYMOB_REDIRECTION_URL?.trim();
    if (!config.canInitiatePayments || !notificationUrl || !redirectionUrl) throw new PaymobUnavailableError();
    return initiatePaymobCheckout({
      payload,
      idempotencyKey: options.idempotencyKey.trim(),
      config,
      notificationUrl,
      redirectionUrl
    });
  }
  return { kind: "cod_order" as const, ...await createOrderFromCheckout(payload, {
    idempotencyKey: options.idempotencyKey.trim()
  }) };
}
