import { createHash } from "node:crypto";
import { z } from "zod";
import { shippingMoneyCentsSchema, shipmentSizeSchema } from "@capella/shared";

export const MAX_SHIPPING_RATE_CENTS = 2_147_483_647;
export const shippingRateAmountSchema = shippingMoneyCentsSchema.max(MAX_SHIPPING_RATE_CENTS);
const identifier = (max = 128) => z.string().min(1).max(max).refine(value => value.trim() === value);

const rateContextSchema = z.object({
  accountId: identifier(),
  environment: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  }),
  pricingContractId: identifier(),
  pickupCity: identifier(),
  dropOffCity: identifier(),
  destinationId: identifier(64),
  size: shipmentSizeSchema,
  providerSize: identifier(),
  serviceType: identifier(32),
  paymentMethod: z.enum(["cod", "prepaid"]),
  codAmountCents: shippingRateAmountSchema
}).refine(context => context.paymentMethod === "cod" || context.codAmountCents === 0,
  "Prepaid delivery must collect zero COD");

export type ShippingRateContext = z.infer<typeof rateContextSchema>;

export function validateShippingRateContext(context: ShippingRateContext): ShippingRateContext {
  return rateContextSchema.parse(context);
}

/** Fixed field order and a versioned digest keep keys bounded and unambiguous. */
export function buildRateIdentity(context: ShippingRateContext): string {
  const c = validateShippingRateContext(context);
  const identity = [c.accountId, c.environment, c.pricingContractId, c.pickupCity,
    c.dropOffCity, c.destinationId, c.size, c.providerSize, c.serviceType,
    c.paymentMethod, c.codAmountCents];
  return `bosta:v2:${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
}
