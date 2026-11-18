import { EG_PHONE_REGEX, GOVERNORATES } from "@capella/shared/constants";
import { createOrderFromCheckout, priceCheckout, requireConfirmedPromo } from "../orders/orders.service.js";
import type { CheckoutPayload } from "../../types/domain.js";
import { resolvePaymobConfig } from "../payments/paymob/paymob-config.js";
import { initiatePaymobCheckout, replayPaymobCheckout } from "./paymob-checkout.service.js";
import { resolveShippingForCheckout } from "../shipping/checkout-shipping-runtime.js";

/** Paymob's smallest online payment (spec section 3.5); a cheaper non-free total must use cash on delivery. */
export const PAYMOB_MINIMUM_CENTS = 1000;

export class PaymobMinimumError extends Error {
  constructor() {
    super("Online payment needs a total of at least EGP 10");
  }
}

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
    const replay = await replayPaymobCheckout(payload, options.idempotencyKey.trim());
    if (replay) return replay;
    const priced = await priceCheckout(payload, { idempotencyKey: options.idempotencyKey.trim() });
    // A code that no longer applies is the first thing the customer hears about, before delivery or amount checks.
    requireConfirmedPromo(priced, payload.promoAcceptedSales);
    const shipping = await resolveShippingForCheckout(payload, priced);
    if (priced.totalAmount === 0 && (shipping?.shippingAmountCents ?? 0) === 0) {
      return { kind: "cod_order" as const, ...await createOrderFromCheckout(payload, {
        idempotencyKey: options.idempotencyKey.trim(), allowFreePrepaid: true
      }) };
    }
    const amountCents = Math.round(priced.totalAmount * 100) + (shipping?.shippingAmountCents ?? 0);
    if (amountCents < PAYMOB_MINIMUM_CENTS) throw new PaymobMinimumError();
    const config = resolvePaymobConfig();
    const notificationUrl = process.env.PAYMOB_NOTIFICATION_URL?.trim();
    const redirectionUrl = process.env.PAYMOB_REDIRECTION_URL?.trim();
    if (!config.canInitiatePayments || !notificationUrl || !redirectionUrl) throw new PaymobUnavailableError();
    return initiatePaymobCheckout({
      payload,
      idempotencyKey: options.idempotencyKey.trim(),
      config,
      notificationUrl,
      redirectionUrl,
      priced,
      shipping
    });
  }
  return { kind: "cod_order" as const, ...await createOrderFromCheckout(payload, {
    idempotencyKey: options.idempotencyKey.trim()
  }) };
}
