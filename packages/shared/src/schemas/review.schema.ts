import { z } from "zod";

export const reviewEntityTypeSchema = z.enum(["product", "offer", "collection"]);
export const reviewStatusSchema = z.enum(["pending", "approved", "rejected", "hidden"]);

export const reviewSubmissionSchema = z.object({
  entityType: reviewEntityTypeSchema,
  entityId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2_000).optional()
});

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;
