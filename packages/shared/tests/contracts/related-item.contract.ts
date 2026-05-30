import { z } from "zod";
import { assertConformsTo, assertForbiddenFieldsAbsent } from "./helpers.js";

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
  price: z.number()
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
