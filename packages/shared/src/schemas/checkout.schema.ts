import { z } from "zod";
import { KW_PHONE_REGEX } from "../constants/index.js";

export const checkoutProductItemSchema = z.object({
  type: z.literal("product"),
  variantId: z.number().int().positive(),
  qty: z.number().int().positive()
});

export const checkoutOfferItemSchema = z.object({
  type: z.literal("offer"),
  offerId: z.number().int().positive(),
  qty: z.number().int().positive()
});

export const checkoutCollectionItemSchema = z.object({
  type: z.literal("collection"),
  collectionId: z.number().int().positive(),
  qty: z.number().int().positive()
});

const checkoutItemsSchema = z.array(z.union([checkoutProductItemSchema, checkoutOfferItemSchema, checkoutCollectionItemSchema])).min(1);
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
  items: checkoutItemsSchema
});

/** Price preview for checkout: the same items and area, nothing else. */
export const checkoutQuoteSchema = z.object({
  areaId: z.number().int().positive(),
  items: checkoutItemsSchema
});

export const checkoutResponseSchema = z.object({
  id: z.number().int().positive(),
  orderCode: z.string().min(1),
  paymentStatus: z.enum(["pending", "accepted"])
});
