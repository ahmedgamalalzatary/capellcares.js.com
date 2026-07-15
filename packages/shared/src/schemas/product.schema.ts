import { z } from "zod";

export function normalizeColorHex(value: string): string {
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split("").map((character) => character.repeat(2)).join("")}`.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toUpperCase();
  }
  throw new Error("Color must be a 3-digit or 6-digit hexadecimal value");
}

export const productSizeSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  label: z.string().trim().min(1),
  sortOrder: z.number().int()
});

export const productColorSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  hex: z.string().transform(normalizeColorHex),
  sortOrder: z.number().int()
});

export const productVariantSchema = z.object({
  id: z.number().int().positive(),
  productId: z.number().int().positive(),
  sizeId: z.number().int().positive(),
  colorId: z.number().int().positive().nullable(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  sortOrder: z.number().int()
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
  sizes: z.array(productSizeSchema),
  colors: z.array(productColorSchema),
  variants: z.array(productVariantSchema)
});
