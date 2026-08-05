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
      db.select({ id: entityMedia.id }).from(entityMedia).where(inArray(entityMedia.url, referenceUrls)).limit(1),
      db.select({ id: products.id }).from(products).where(inArray(products.imagePath, referenceUrls)).limit(1),
      db.select({ id: offers.id }).from(offers).where(inArray(offers.imagePath, referenceUrls)).limit(1),
      db.select({ id: collections.id }).from(collections).where(inArray(collections.imagePath, referenceUrls)).limit(1),
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
