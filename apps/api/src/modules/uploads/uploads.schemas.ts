import { z } from "zod";

const supportedMimeTypes = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"] as const;

export const uploadMediaSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(supportedMimeTypes),
  contentBase64: z.string().min(1)
});

export type UploadMediaPayload = z.infer<typeof uploadMediaSchema>;

export function parseUploadBody(input: unknown): UploadMediaPayload {
  return uploadMediaSchema.parse(input);
}
