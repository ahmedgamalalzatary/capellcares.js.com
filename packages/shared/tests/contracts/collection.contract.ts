import { z } from "zod";
import { assertConformsTo, assertForbiddenFieldsAbsent } from "./helpers.js";
import { storefrontRatingContract } from "./rating.contract.js";

const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string()
});

export const storefrontCollectionContract = z.object({
  id: z.number(),
  slug: z.string(),
  name: bilingualSchema,
  description: bilingualSchema,
  youtubeUrl: z.string().nullable().optional(),
  imagePath: z.string(),
  media: z.array(
    z.object({
      type: z.enum(["image", "video"]),
      url: z.string()
    })
  ),
  price: z.number(),
  originalTotal: z.number(),
  categoryId: z.number(),
  items: z.array(
    z.object({
      id: z.number().optional(),
      variantId: z.number(),
      qty: z.number()
    })
  ),
  stock: z.number(),
  rating: storefrontRatingContract,
  status: z.enum(["active", "inactive"]),
  visibility: z.enum(["visible", "hidden"])
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
