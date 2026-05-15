import { z } from "zod";

const supportedMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;

export const uploadImageSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(supportedMimeTypes),
  contentBase64: z.string().min(1)
});

export type UploadImagePayload = z.infer<typeof uploadImageSchema>;

export function parseUploadBody(input: unknown): UploadImagePayload {
  return uploadImageSchema.parse(input);
}
