import { z } from "zod";
import { assertConformsTo, assertForbiddenFieldsAbsent } from "./helpers.js";
import { storefrontRatingContract } from "./rating.contract.js";

const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string()
});

export const storefrontRelatedItemContract = z.object({
  type: z.enum(["product", "offer", "collection"]),
  id: z.number(),
  slug: z.string(),
  name: bilingualSchema,
  imagePath: z.string().nullable(),
  price: z.number(),
  // The card renders the same controls as ProductCard/SectionCard, so it needs
  // a variant to add, the pre-saving price, and a classification line.
  variantId: z.number().nullable(),
  originalTotal: z.number().nullable(),
  categoryName: bilingualSchema.nullable(),
  rating: storefrontRatingContract
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
