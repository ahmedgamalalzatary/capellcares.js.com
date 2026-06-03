import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { UploadMediaPayload } from "./uploads.schemas.js";

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

async function saveMediaBuffer(input: {
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

function getAllowedMimeTypes() {
  const raw = process.env.UPLOAD_ALLOWED_MIME_TYPES ?? "image/png,image/jpeg,image/webp,video/mp4,video/webm";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getMaxBytes() {
  const parsed = Number(process.env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20 * 1024 * 1024;
}

function resolvePublicBaseUrl(): string {
  const configured = (process.env.HOSTINGER_PUBLIC_BASE_URL ?? "").trim();
  if (!configured || configured.includes("example.com/uploads")) {
    return "http://localhost:4000/uploads";
  }
  return configured;
}

export async function uploadBase64Media(
  payload: UploadMediaPayload,
  options?: {
    uploadsDir?: string;
    publicBaseUrl?: string;
    maxBytes?: number;
  }
) {
  const allowedMimeTypes = getAllowedMimeTypes();
  if (!allowedMimeTypes.has(payload.mimeType.toLowerCase())) {
    throw new Error(`Unsupported mime type: ${payload.mimeType}`);
  }

  const buffer = Buffer.from(payload.contentBase64, "base64");
  const maxBytes = options?.maxBytes ?? getMaxBytes();
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Upload exceeds maximum size of ${maxBytes} bytes`);
  }

  const uploadsDir = options?.uploadsDir ?? resolve(process.cwd(), "uploads");
  const publicBaseUrl =
    options?.publicBaseUrl ??
    resolvePublicBaseUrl();

  return saveMediaBuffer({
    uploadsDir,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    buffer,
    publicBaseUrl
  });
}
