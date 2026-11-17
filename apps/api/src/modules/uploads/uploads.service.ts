import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { inArray, or } from "drizzle-orm";
import { collections, entityMedia, offers, products, shopMediaSectionItems } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import type { UploadMediaPayload } from "./uploads.schemas.js";

type AllowedMimeType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm";

const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm"
};

/** An upload refused for a reason the uploader can act on; only these messages are shown to the client, every other failure stays a generic server error. */
export class UploadRejectedError extends Error {}

/** Leading bytes ("magic numbers") each allowed type must start with, so a file cannot claim to be an image while carrying HTML or a script. */
function matchesMimeSignature(mimeType: AllowedMimeType, buffer: Buffer): boolean {
  const startsWith = (bytes: number[], offset = 0) =>
    buffer.length >= offset + bytes.length && bytes.every((byte, index) => buffer[offset + index] === byte);
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
  switch (mimeType) {
    case "image/png": return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg": return startsWith([0xff, 0xd8, 0xff]);
    case "image/webp": return startsWith(ascii("RIFF")) && startsWith(ascii("WEBP"), 8);
    case "video/mp4": return startsWith(ascii("ftyp"), 4);
    case "video/webm": return startsWith([0x1a, 0x45, 0xdf, 0xa3]);
  }
}

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

function getMaxBytes(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.UPLOAD_MAX_BYTES ?? 20 * 1024 * 1024);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20 * 1024 * 1024;
}

/** JSON body limit for the upload route: the base64 form of the largest allowed file (4 bytes per 3) plus room for the other fields. */
export function resolveUploadBodyLimitBytes(env: NodeJS.ProcessEnv = process.env): number {
  return Math.ceil(getMaxBytes(env) / 3) * 4 + 64 * 1024;
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
    throw new UploadRejectedError(`Unsupported mime type: ${payload.mimeType}`);
  }

  const buffer = Buffer.from(payload.contentBase64, "base64");
  const maxBytes = options?.maxBytes ?? getMaxBytes();
  if (buffer.byteLength > maxBytes) {
    throw new UploadRejectedError(`Upload exceeds maximum size of ${maxBytes} bytes`);
  }
  if (!matchesMimeSignature(payload.mimeType, buffer)) {
    throw new UploadRejectedError(`File content does not match the declared type ${payload.mimeType}`);
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

function localUploadPath(url: string): string | null {
  if (url.startsWith("/uploads/")) return url;
  const publicBase = resolvePublicBaseUrl().replace(/\/+$/, "");
  if (!url.startsWith(`${publicBase}/`)) return null;
  return `/uploads/${url.slice(publicBase.length + 1)}`;
}

export async function deleteLocalUploadUrls(urls: Array<string | null | undefined>) {
  const uploadsDir = resolve(process.cwd(), "uploads");
  const urlsByPath = new Map<string, Set<string>>();
  for (const url of urls) {
    if (!url) continue;
    const uploadPath = localUploadPath(url);
    if (!uploadPath) continue;
    const matchingUrls = urlsByPath.get(uploadPath) ?? new Set<string>();
    matchingUrls.add(url);
    urlsByPath.set(uploadPath, matchingUrls);
  }

  for (const [uploadPath, originalUrls] of urlsByPath) {
    const absolutePath = resolve(uploadsDir, uploadPath.slice("/uploads/".length));
    const relativePath = relative(uploadsDir, absolutePath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      console.warn(`Skipped unlink outside uploads directory: ${absolutePath}`);
      continue;
    }
    const publicUrl = `${resolvePublicBaseUrl().replace(/\/+$/, "")}/${uploadPath.slice("/uploads/".length)}`;
    const referenceUrls = [...new Set([uploadPath, publicUrl, ...originalUrls])];
    const references = await Promise.all([
      db.select({ id: entityMedia.id }).from(entityMedia).where(or(
        inArray(entityMedia.url, referenceUrls),
        inArray(entityMedia.arUrl, referenceUrls)
      )).limit(1),
      db.select({ id: products.id }).from(products).where(or(
        inArray(products.imagePath, referenceUrls),
        inArray(products.hoverImagePath, referenceUrls),
        inArray(products.arHoverImagePath, referenceUrls)
      )).limit(1),
      db.select({ id: offers.id }).from(offers).where(or(
        inArray(offers.imagePath, referenceUrls),
        inArray(offers.hoverImagePath, referenceUrls),
        inArray(offers.arHoverImagePath, referenceUrls)
      )).limit(1),
      db.select({ id: collections.id }).from(collections).where(or(
        inArray(collections.imagePath, referenceUrls),
        inArray(collections.hoverImagePath, referenceUrls),
        inArray(collections.arHoverImagePath, referenceUrls)
      )).limit(1),
      db.select({ id: shopMediaSectionItems.id }).from(shopMediaSectionItems).where(or(
        inArray(shopMediaSectionItems.arImagePath, referenceUrls),
        inArray(shopMediaSectionItems.arMobileImagePath, referenceUrls),
        inArray(shopMediaSectionItems.enImagePath, referenceUrls),
        inArray(shopMediaSectionItems.enMobileImagePath, referenceUrls)
      )).limit(1)
    ]);
    if (references.some((rows) => rows.length > 0)) continue;
    try {
      await unlink(absolutePath);
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        console.warn(`Failed to unlink uploaded media ${absolutePath}:`, error?.message ?? error);
      }
    }
  }
}
