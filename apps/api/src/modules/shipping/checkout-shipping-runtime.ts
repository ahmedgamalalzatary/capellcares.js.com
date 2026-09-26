import { z } from "zod";
import type { CheckoutRequestDto, CheckoutShippingQuote } from "@capella/shared";
import { loadBostaConfig } from "./bosta/bosta-config.js";
import { createBostaQuoteService } from "./bosta/bosta-quote-composition.js";
import { validatePricingResponseContract } from "./bosta/bosta-pricing.service.js";
import { createCheckoutShippingService, CheckoutShippingError, type CheckoutShippingService } from "./checkout-shipping.service.js";

const settingsSchema = z.object({
  accountVerified: z.literal(true), accountEvidence: z.string().trim().min(1),
  accountId: z.string().trim().min(1).max(128), pickupCity: z.string().trim().min(1).max(128),
  codUnit: z.enum(["major", "minor"]), codPricingPolicy: z.literal("collection_total"),
  sizeMapping: z.object({ small: z.string().min(1), medium: z.string().min(1), large: z.string().min(1) }),
  responseContract: z.object({ verified: z.literal(true), evidence: z.string().trim().min(1),
    amountPath: z.array(z.string().min(1)).min(1), currency: z.literal("EGP"), unit: z.enum(["major", "minor"]),
    vatIncluded: z.literal(true), feesIncluded: z.literal(true) })
});

export function checkoutShippingServiceFromEnvironment(env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch): CheckoutShippingService | null {
  try {
    const config = loadBostaConfig(env);
    if (!config.enabled) return null;
    const settings = settingsSchema.parse(JSON.parse(env.BOSTA_QUOTE_SETTINGS_JSON ?? "null"));
    validatePricingResponseContract(settings.responseContract);
    return createCheckoutShippingService({ ...createBostaQuoteService(config, settings, fetchImpl),
      codPricingPolicy: settings.codPricingPolicy });
  } catch {
    // Keep credentials, provider payloads and account details out of public errors.
    throw new CheckoutShippingError("SHIPPING_UNAVAILABLE");
  }
}

export async function resolveShippingForCheckout(payload: CheckoutRequestDto, priced: { items: unknown[]; totalAmount: number },
  service?: CheckoutShippingService): Promise<CheckoutShippingQuote | null> {
  const active = service ?? checkoutShippingServiceFromEnvironment();
  if (!active) {
    if (payload.shippingQuoteId || payload.shippingAddress) throw new CheckoutShippingError("SHIPPING_QUOTE_CHANGED");
    return null;
  }
  return active.resolve(payload, priced);
}
