import { z } from "zod";

export const reviewEntityTypeSchema = z.enum(["product", "offer", "collection"]);

export const reviewCreateSchema = z.object({
  entityType: reviewEntityTypeSchema,
  entityId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(1000)
});
