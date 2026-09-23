import { z } from "zod";

const cartLineQtySchema = z.number().int().positive().max(999);

export const cartProductLineSchema = z.object({
  type: z.literal("product"),
  productId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  qty: cartLineQtySchema
});

export const cartOfferLineSchema = z.object({
  type: z.literal("offer"),
  offerId: z.number().int().positive(),
  qty: cartLineQtySchema
});

export const cartCollectionLineSchema = z.object({
  type: z.literal("collection"),
  collectionId: z.number().int().positive(),
  qty: cartLineQtySchema
});

export const cartLineSchema = z.discriminatedUnion("type", [
  cartProductLineSchema,
  cartOfferLineSchema,
  cartCollectionLineSchema
]);

export const cartLinesSchema = z.array(cartLineSchema).max(200);

export const cartReplacePayloadSchema = z.object({
  lines: cartLinesSchema
});
