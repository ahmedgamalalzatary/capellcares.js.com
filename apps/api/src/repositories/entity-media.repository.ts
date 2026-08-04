import { asc, eq, inArray } from "drizzle-orm";
import { entityMedia } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

const FALLBACK_PUBLIC_UPLOADS_BASE = "http://localhost:4000/uploads";

export type EntityMediaItem = {
  type: "image" | "video";
  url: string;
};

export type EntityMediaOwner =
  | { type: "product"; id: number }
  | { type: "offer"; id: number }
  | { type: "collection"; id: number };

type EntityMediaOwnerType = EntityMediaOwner["type"];
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function parseEntityMediaInput(value: unknown): EntityMediaItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const media = value
    .map((item: any) => ({
      type: item?.type === "video" ? "video" as const : "image" as const,
      url: String(item?.url ?? "").trim()
    }))
    .filter((item) => item.url.length > 0);
  if (media.filter((item) => item.type === "video").length > 1) {
    const error = new Error("Only one video is allowed per entity") as Error & { code?: string };
    error.code = "ENTITY_MEDIA_VIDEO_LIMIT";
    throw error;
  }
  return media;
}

function getPublicUploadsBase(): string {
  const configured = (process.env.HOSTINGER_PUBLIC_BASE_URL ?? "").trim();
  if (!configured || configured.includes("example.com/uploads")) {
    return FALLBACK_PUBLIC_UPLOADS_BASE;
  }
  return configured.replace(/\/+$/, "");
}

export function resolvePublicEntityMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith("/uploads/")) {
    return `${getPublicUploadsBase()}${url.slice("/uploads".length)}`;
  }
  return url;
}

export function normalizeEntityMedia(
  rows: Array<{ mediaType: "image" | "video"; url: string; sortOrder: number }> | undefined,
  imagePath: string | null | undefined
): EntityMediaItem[] {
  const ordered = (rows ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({ type: row.mediaType, url: resolvePublicEntityMediaUrl(row.url) }));

  if (ordered.length > 0) return ordered;
  return imagePath ? [{ type: "image", url: resolvePublicEntityMediaUrl(imagePath) }] : [];
}

export function resolvePrimaryEntityImagePath(
  media: EntityMediaItem[],
  imagePath: string | null | undefined
) {
  const firstImage = media.find((item) => item.type === "image");
  return firstImage?.url ?? (imagePath ? resolvePublicEntityMediaUrl(imagePath) : null);
}

function ownerColumn(type: EntityMediaOwnerType) {
  return type === "product"
    ? entityMedia.productId
    : type === "offer"
      ? entityMedia.offerId
      : entityMedia.collectionId;
}

export async function loadEntityMediaRows(type: EntityMediaOwnerType, ids: number[]) {
  if (ids.length === 0) {
    return new Map<number, Array<{ mediaType: "image" | "video"; url: string; sortOrder: number }>>();
  }

  const column = ownerColumn(type);
  const rows = await db
    .select({
      ownerId: column,
      mediaType: entityMedia.mediaType,
      url: entityMedia.url,
      sortOrder: entityMedia.sortOrder
    })
    .from(entityMedia)
    .where(inArray(column, ids))
    .orderBy(asc(entityMedia.sortOrder), asc(entityMedia.id));

  const byOwner = new Map<number, Array<{ mediaType: "image" | "video"; url: string; sortOrder: number }>>();
  for (const row of rows) {
    if (row.ownerId == null) continue;
    const list = byOwner.get(row.ownerId) ?? [];
    list.push({ mediaType: row.mediaType, url: row.url, sortOrder: row.sortOrder });
    byOwner.set(row.ownerId, list);
  }
  return byOwner;
}

async function replaceEntityMediaWithin(
  tx: DbTransaction,
  owner: EntityMediaOwner,
  media: EntityMediaItem[]
) {
  const column = ownerColumn(owner.type);
  await tx.delete(entityMedia).where(eq(column, owner.id));
  if (media.length === 0) return;

  await tx.insert(entityMedia).values(media.map((item, index) => ({
    productId: owner.type === "product" ? owner.id : null,
    offerId: owner.type === "offer" ? owner.id : null,
    collectionId: owner.type === "collection" ? owner.id : null,
    mediaType: item.type,
    url: item.url,
    sortOrder: index + 1
  })));
}

export async function replaceEntityMediaRepo(
  owner: EntityMediaOwner,
  media: EntityMediaItem[],
  executor?: DbTransaction
) {
  if (executor) {
    await replaceEntityMediaWithin(executor, owner, media);
    return;
  }
  await db.transaction((tx) => replaceEntityMediaWithin(tx, owner, media));
}
