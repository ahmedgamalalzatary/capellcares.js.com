import { z } from "zod";

const announcementTextSchema = z.string().trim().min(1).max(500);

export const announcementItemSchema = z.object({
  id: z.number().int().positive(),
  text: z.object({
    ar: announcementTextSchema,
    en: announcementTextSchema
  }),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative()
});

export const announcementBarSchema = z.object({
  enabled: z.boolean(),
  items: z.array(announcementItemSchema)
});
