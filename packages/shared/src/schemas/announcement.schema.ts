import { z } from "zod";

export const announcementSchema = z.object({
  id: z.number().int().positive(),
  arText: z.string().min(1).max(255),
  enText: z.string().min(1).max(255),
  status: z.enum(["active", "inactive"]),
  sortOrder: z.number().int(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const announcementReplaceItemSchema = z.object({
  arText: z.string().trim().min(1).max(255),
  enText: z.string().trim().min(1).max(255),
  status: z.enum(["active", "inactive"]),
  sortOrder: z.number().int()
});

export const announcementReplacePayloadSchema = z.object({
  barStatus: z.enum(["active", "inactive"]).optional().default("active"),
  items: z.array(announcementReplaceItemSchema)
});
