import { z } from "zod";

export const shippingMoneyCentsSchema = z.number().int().nonnegative().safe();

export const shipmentSizeSchema = z.enum(["small", "medium", "large"]);

const shippingIdSchema = z.string().trim().min(1).max(64);
export const shippingAddressSchema = z.object({
  cityId: shippingIdSchema, zoneId: shippingIdSchema, districtId: shippingIdSchema
});
const shippingNameSchema = z.object({ en: z.string().min(1), ar: z.string().min(1) });
export const shippingDestinationSchema = shippingAddressSchema.extend({
  cityName: shippingNameSchema, zoneName: shippingNameSchema, districtName: shippingNameSchema
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type ShippingDestination = z.infer<typeof shippingDestinationSchema>;

export const shipmentKindSchema = z.enum(["outgoing", "return", "exchange"]);

export const shippingQuoteRequestSchema = z.object({
  cityId: z.string().min(1),
  zoneId: z.string().min(1),
  districtId: z.string().min(1),
  productsTotalCents: shippingMoneyCentsSchema
});

export const shippingQuoteResponseSchema = z.object({
  quoteId: z.string().min(1),
  shippingAmountCents: shippingMoneyCentsSchema,
  size: shipmentSizeSchema,
  rateIdentity: z.string().min(1),
  quotedAt: z.string().datetime()
});

export const checkoutShippingQuoteSchema = shippingQuoteResponseSchema.extend({
  productsTotalCents: shippingMoneyCentsSchema,
  amountCents: shippingMoneyCentsSchema.max(2_147_483_647),
  codAmountCents: shippingMoneyCentsSchema.max(2_147_483_647),
  paymentMethod: z.enum(["cod", "paymob"]),
  address: shippingDestinationSchema
});
export type CheckoutShippingQuote = z.infer<typeof checkoutShippingQuoteSchema>;
export type CheckoutShippingAvailability = { enabled: boolean; addresses: ShippingDestination[] };

export const shipmentNormalizedStateSchema = z.enum([
  "created",
  "picked_up",
  "in_transit",
  "delivered",
  "returned",
  "cancelled",
  "exception"
]);

export const shipmentManualStateSchema = z.enum([
  "preparing",
  "ready_for_pickup",
  "printed",
  "delivered",
  "returned"
]);

export const shipmentStateSchema = z.object({
  rawProviderState: z.string().min(1),
  rawProviderCode: z.number().int(),
  normalizedState: shipmentNormalizedStateSchema,
  manualState: shipmentManualStateSchema.nullable()
});
