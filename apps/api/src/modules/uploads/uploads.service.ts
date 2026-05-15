import { resolve } from "node:path";
import { saveImageBuffer } from "../../services/image.service.js";
import type { UploadImagePayload } from "./uploads.schemas.js";

function getAllowedMimeTypes() {
  const raw = process.env.UPLOAD_ALLOWED_MIME_TYPES ?? "image/png,image/jpeg,image/webp";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getMaxBytes() {
  const parsed = Number(process.env.UPLOAD_MAX_BYTES ?? 4 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4 * 1024 * 1024;
}

function resolvePublicBaseUrl(): string {
  const configured = (process.env.HOSTINGER_PUBLIC_BASE_URL ?? "").trim();
  if (!configured || configured.includes("example.com/uploads")) {
    return "http://localhost:4000/uploads";
  }
  return configured;
}

export async function uploadBase64Image(
  payload: UploadImagePayload,
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

  return saveImageBuffer({
    uploadsDir,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    buffer,
    publicBaseUrl
  });
}
