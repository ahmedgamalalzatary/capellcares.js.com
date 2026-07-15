import { z } from "zod";
import { assertConformsTo, assertForbiddenFieldsAbsent } from "./helpers.js";

const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string()
});

export const storefrontProductContract = z.object({
  id: z.number(),
  sku: z.string(),
  slug: z.string(),
  name: bilingualSchema,
  description: bilingualSchema,
  ingredients: bilingualSchema,
  howToUse: bilingualSchema,
  warnings: bilingualSchema,
  keywords: z.array(z.string()),
  imagePath: z.string().nullable(),
  hoverImagePath: z.string().nullable(),
  media: z.array(
    z.object({
      type: z.enum(["image", "video"]),
      url: z.string()
    })
  ),
  youtubeUrl: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  categoryId: z.number(),
  sizes: z.array(
    z.object({
      id: z.number(),
      productId: z.number(),
      label: z.string(),
      sortOrder: z.number()
    })
  ),
  colors: z.array(
    z.object({
      id: z.number(),
      productId: z.number(),
      hex: z.string().regex(/^#[0-9A-F]{6}$/),
      sortOrder: z.number()
    })
  ),
  variants: z.array(
    z.object({
      id: z.number(),
      productId: z.number(),
      sizeId: z.number(),
      colorId: z.number().nullable(),
      price: z.number(),
      stock: z.number(),
      sortOrder: z.number()
    })
  )
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
