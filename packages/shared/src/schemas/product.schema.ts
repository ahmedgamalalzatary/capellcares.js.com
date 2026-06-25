import { z } from "zod";

export const productVariantSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  sizeLabel: z.string().min(1),
  sellingPrice: z.number().nonnegative(),
  stockQty: z.number().int().nonnegative(),
  sortOrder: z.number().int(),
  discount: z.object({
    id: z.number().int().positive().optional(),
    variantId: z.number().int().positive().optional(),
    type: z.enum(["percentage", "fixed"]),
    value: z.number().positive(),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    status: z.enum(["active", "inactive"])
  }).nullable().optional()
});

export const productMediaSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().min(1)
});

export const productSchema = z.object({
  id: z.number().int().positive(),
  sku: z.string().min(1),
  slug: z.string().min(1),
  arName: z.string().min(1),
  enName: z.string().min(1),
  buyingPrice: z.number().nonnegative(),
  keywords: z.array(z.string()),
  arDescription: z.string().nullable(),
  enDescription: z.string().nullable(),
  arIngredients: z.string().nullable(),
  enIngredients: z.string().nullable(),
  arHowToUse: z.string().nullable(),
  enHowToUse: z.string().nullable(),
  arWarnings: z.string().nullable(),
  enWarnings: z.string().nullable(),
  youtubeUrl: z.string().nullable(),
  imagePath: z.string().nullable(),
  hoverImagePath: z.string().nullable(),
  media: z.array(productMediaSchema),
  status: z.enum(["active", "inactive"]),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  categoryId: z.number().int().positive(),
  deletedAt: z.string().nullable(),
  variants: z.array(productVariantSchema)
});
