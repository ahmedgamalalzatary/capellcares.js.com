import { z } from "zod";

export const collectionItemSchema = z.object({
  id: z.number().int().positive(),
  collectionId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  qty: z.number().int().positive()
});

export const collectionSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  arName: z.string().min(1),
  enName: z.string().min(1),
  arDescription: z.string().nullable(),
  enDescription: z.string().nullable(),
  imagePath: z.string().nullable(),
  fixedPrice: z.number().nonnegative(),
  categoryId: z.number().int().positive(),
  status: z.enum(["active", "inactive"]),
  visibility: z.enum(["visible", "hidden"]),
  deletedAt: z.string().nullable(),
  items: z.array(collectionItemSchema)
});
