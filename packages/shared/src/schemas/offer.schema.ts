import { z } from "zod";
import { entityMediaSchema } from "./product.schema.js";

export const offerItemSchema = z.object({
  id: z.number().int().positive(),
  offerId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  qty: z.number().int().positive()
});

export const offerSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  arName: z.string().min(1),
  enName: z.string().min(1),
  arDescription: z.string().nullable(),
  enDescription: z.string().nullable(),
  imagePath: z.string().nullable(),
  media: z.array(entityMediaSchema),
  fixedPrice: z.number().nonnegative(),
  categoryId: z.number().int().positive().nullable(),
  status: z.enum(["active", "inactive"]),
  visibility: z.enum(["visible", "hidden"]),
  deletedAt: z.string().nullable(),
  items: z.array(offerItemSchema)
});
