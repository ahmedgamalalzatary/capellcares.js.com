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
  youtubeUrl: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  categoryId: z.number(),
  variants: z.array(
    z.object({
      id: z.number(),
      productId: z.number(),
      size: z.string(),
      price: z.number(),
      stock: z.number(),
      sortOrder: z.number().optional()
    })
  )
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
