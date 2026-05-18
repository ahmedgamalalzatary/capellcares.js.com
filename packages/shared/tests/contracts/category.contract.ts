import { z } from "zod";
import { assertConformsTo, assertForbiddenFieldsAbsent } from "./helpers.js";

export const storefrontCategoryContract = z.object({
  id: z.number(),
  parentId: z.number().nullable(),
  slug: z.string(),
  name: z.object({
    ar: z.string(),
    en: z.string()
  }),
  isLeaf: z.boolean(),
  deletedAt: z.string().nullable().optional()
});

export { assertConformsTo, assertForbiddenFieldsAbsent };
