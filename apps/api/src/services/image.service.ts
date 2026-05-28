import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";

type AllowedMimeType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm";

const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm"
};

function sanitizeFileName(input: string): string {
  return basename(input).replace(/[^a-zA-Z0-9._-]/g, "-");
}

export async function saveMediaBuffer(input: {
  uploadsDir: string;
  fileName: string;
  mimeType: AllowedMimeType;
  buffer: Buffer;
  publicBaseUrl: string;
}) {
  const safeBaseName = sanitizeFileName(input.fileName).replace(/\.[^.]+$/, "");
  const ext = MIME_TO_EXTENSION[input.mimeType];
  const storedFileName = `${safeBaseName || "image"}-${randomUUID()}.${ext}`;

  await mkdir(input.uploadsDir, { recursive: true });
  const absolutePath = join(input.uploadsDir, storedFileName);
  await writeFile(absolutePath, input.buffer);

  const base = input.publicBaseUrl.replace(/\/+$/, "");
  return {
    fileName: storedFileName,
    path: `/uploads/${storedFileName}`,
    url: `${base}/${storedFileName}`
  };
}
