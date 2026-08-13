import { z } from "zod";
import { assertConformsTo, assertForbiddenFieldsAbsent } from "./helpers.js";
import { storefrontRatingContract } from "./rating.contract.js";
import { storefrontEntityMediaContract } from "./entity-media.contract.js";

const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string()
});

export const storefrontOfferContract = z.object({
  id: z.number(),
  slug: z.string(),
  name: bilingualSchema,
  description: bilingualSchema,
  youtubeUrl: z.string().nullable().optional(),
  imagePath: z.string().nullable(),
  media: z.array(storefrontEntityMediaContract),
  price: z.number(),
  originalTotal: z.number(),
  categoryId: z.number().nullable(),
  stock: z.number().int().nonnegative(),
  rating: storefrontRatingContract,
  status: z.enum(["active", "inactive"]),
  visibility: z.enum(["visible", "hidden"]),
  items: z.array(
    z.object({
      variantId: z.number(),
      qty: z.number()
    })
  )
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
