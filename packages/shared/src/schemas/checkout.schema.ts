import { z } from "zod";
import { KW_PHONE_REGEX } from "../constants/index.js";

// The same limits as the saved cart: pricing work stays small however the request is built.
const checkoutQtySchema = z.number().int().positive().max(999);

export const checkoutProductItemSchema = z.object({
  type: z.literal("product"),
  variantId: z.number().int().positive(),
  qty: checkoutQtySchema
});

export const checkoutOfferItemSchema = z.object({
  type: z.literal("offer"),
  offerId: z.number().int().positive(),
  qty: checkoutQtySchema
});

export const checkoutCollectionItemSchema = z.object({
  type: z.literal("collection"),
  collectionId: z.number().int().positive(),
  qty: checkoutQtySchema
});

const checkoutItemsSchema = z.array(z.union([checkoutProductItemSchema, checkoutOfferItemSchema, checkoutCollectionItemSchema])).min(1).max(200);

/** A promo code as typed; matched without case or surrounding spaces. Empty text means no code. */
const promoCodeTextSchema = z.string().trim().max(64).transform((value) => value || undefined).optional();

/** The checkout phone, once typed: a code is then checked against it as it will be at checkout (first order, per customer). */
const promoPhoneSchema = z.string().trim().regex(KW_PHONE_REGEX, "Invalid Kuwaiti phone number").optional();

/** The cart priced by the server, with an optional promo code (docs/promo-codes-spec.md section 5.1). */
export const checkoutPriceRequestSchema = z.object({
  items: checkoutItemsSchema,
  promoCode: promoCodeTextSchema,
  phone: promoPhoneSchema
});

export const checkoutSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().regex(KW_PHONE_REGEX, "Invalid Kuwaiti phone number"),
  email: z.string().email(),
  areaId: z.number().int().positive(),
  addressLine: z.string().min(1),
  buildingApartment: z.string().min(1),
  notes: z.string().optional(),
  paymentMethod: z.literal("cod"),
  /** The total the customer saw (items + delivery) in fils; a mismatch means prices or fees changed. */
  expectedAmountFils: z.number().int().nonnegative().safe().optional(),
  customerId: z.number().int().positive().nullable().optional(),
  promoCode: promoCodeTextSchema,
  /** The sale replacements the customer confirmed for the code, exactly as shown (spec sections 3.4 and 7, case 26). */
  promoAcceptedSales: z.array(z.object({ item: z.string().min(1).max(64), previousLineTotal: z.number().finite(), lineTotal: z.number().finite() }).strict())
    .max(200).optional(),
  items: checkoutItemsSchema
});

/** Price preview for checkout: the same items and area, with the promo code and phone when there are any. */
export const checkoutQuoteSchema = z.object({
  areaId: z.number().int().positive(),
  items: checkoutItemsSchema,
  promoCode: promoCodeTextSchema,
  phone: promoPhoneSchema
});

export const checkoutResponseSchema = z.object({
  id: z.number().int().positive(),
  orderCode: z.string().min(1),
  paymentStatus: z.enum(["pending", "accepted"])
});
