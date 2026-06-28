import { z } from "zod";

const wishlistEntityTypeSchema = z.enum(["product", "offer", "collection"]);

export const wishlistItemSchema = z.object({
  id: z.number().int().positive(),
  customerId: z.number().int().positive(),
  entityType: wishlistEntityTypeSchema,
  entityId: z.number().int().positive(),
  createdAt: z.string().optional()
});

export const wishlistEntrySchema = z.object({
  entityType: wishlistEntityTypeSchema,
  entityId: z.number().int().positive(),
  name: z.object({
    ar: z.string().min(1),
    en: z.string().min(1)
  }),
  imagePath: z.string().nullable(),
  href: z.string().nullable(),
  availability: z.enum(["available", "unavailable"])
});
