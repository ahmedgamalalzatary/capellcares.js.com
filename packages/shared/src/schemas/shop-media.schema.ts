import { z } from "zod";

export const shopMediaTargetTypeSchema = z.enum([
  "shop",
  "new",
  "bestsellers",
  "products",
  "product",
  "offers",
  "offer",
  "collections",
  "collection",
  "category"
]);

export const shopMediaSectionItemSchema = z.object({
  id: z.number().int().positive(),
  imagePath: z.string().min(1),
  mobileImagePath: z.string().min(1),
  targetType: shopMediaTargetTypeSchema,
  targetId: z.number().int().positive().nullable(),
  targetSlug: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const shopMediaSectionSchema = z.object({
  id: z.number().int().positive(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(["active", "inactive"]),
  items: z.array(shopMediaSectionItemSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
