import { z } from "zod";
import { assertConformsTo, assertForbiddenFieldsAbsent } from "./helpers.js";
import { storefrontRatingContract } from "./rating.contract.js";

const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string()
});

export const storefrontOfferContract = z.object({
  id: z.number(),
  slug: z.string(),
  name: bilingualSchema,
  description: bilingualSchema,
  imagePath: z.string().nullable(),
  price: z.number(),
  originalTotal: z.number(),
  stock: z.number().int().nonnegative(),
  rating: storefrontRatingContract,
  status: z.enum(["active", "inactive"]),
  items: z.array(
    z.object({
      variantId: z.number(),
      qty: z.number()
    })
  )
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
