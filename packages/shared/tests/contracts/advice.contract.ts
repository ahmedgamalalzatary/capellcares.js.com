import { z } from "zod";
import { assertConformsTo } from "./helpers.js";

const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string()
});

export const storefrontAdviceContract = z.object({
  id: z.number().int().positive(),
  title: bilingualSchema,
  description: bilingualSchema,
  imagePath: z.string().nullable(),
  videoUrl: z.string().nullable(),
  status: z.enum(["active", "inactive"]),
  sortOrder: z.number().int()
});

export { assertConformsTo };
