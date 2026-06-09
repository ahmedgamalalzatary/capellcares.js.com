import { z } from "zod";

export const categorySchema = z.object({
  id: z.number().int().positive(),
  parentId: z.number().int().positive().nullable(),
  slug: z.string().min(1),
  sortOrder: z.number().int().nonnegative().optional(),
  arName: z.string().min(1),
  enName: z.string().min(1),
  isLeaf: z.boolean(),
  deletedAt: z.string().nullable()
});
