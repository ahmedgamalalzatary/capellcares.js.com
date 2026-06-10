import { z } from "zod";
import { EG_PHONE_REGEX, GOVERNORATES } from "../constants/index.js";

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

export const checkoutSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().regex(EG_PHONE_REGEX, "Invalid Egyptian phone number"),
  email: z.string().email(),
  governorate: z.enum(GOVERNORATES),
  cityArea: z.string().min(1),
  addressLine: z.string().min(1),
  buildingApartment: z.string().min(1),
  notes: z.string().optional(),
  paymentMethod: z.literal("cod"),
  customerId: z.number().int().positive().nullable().optional(),
  items: z.array(z.union([checkoutProductItemSchema, checkoutOfferItemSchema, checkoutCollectionItemSchema])).min(1)
});
