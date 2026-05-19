import { z } from "zod";

const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string()
});

export const adviceSchema = z.object({
  id: z.number().int().positive(),
  title: bilingualSchema,
  description: bilingualSchema,
  imagePath: z.string().nullable(),
  videoUrl: z.string().nullable(),
  status: z.enum(["active", "inactive"]),
  sortOrder: z.number().int(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});
