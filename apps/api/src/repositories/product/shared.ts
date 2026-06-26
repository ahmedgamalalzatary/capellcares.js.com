import { asc, eq, inArray, sql } from "drizzle-orm";
import { productMedia, productVariants } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";

const FALLBACK_PUBLIC_UPLOADS_BASE = "http://localhost:4000/uploads";

export type ProductMediaItem = {
  type: "image" | "video";
  url: string;
};

export function normalizeVariantSizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export function toKeywords(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function mapVariant(v: {
  id: number;
  productId: number;
  sizeLabel: string;
  sellingPrice: unknown;
  stockQty: number;
  sortOrder: number;
}) {
  return {
    id: v.id,
    productId: v.productId,
    size: v.sizeLabel,
    price: toNumber(v.sellingPrice),
    stock: v.stockQty,
    sortOrder: v.sortOrder
  };
}

function getPublicUploadsBase(): string {
  const configured = (process.env.HOSTINGER_PUBLIC_BASE_URL ?? "").trim();
  if (!configured || configured.includes("example.com/uploads")) {
    return FALLBACK_PUBLIC_UPLOADS_BASE;
  }
  return configured.replace(/\/+$/, "");
}

function resolvePublicMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/uploads/")) {
    return `${getPublicUploadsBase()}${url.slice("/uploads".length)}`;
  }

  return url;
}

export function normalizeMedia(
  rows: Array<{ mediaType: "image" | "video"; url: string; sortOrder: number }> | undefined,
  imagePath: string | null | undefined
): ProductMediaItem[] {
  const ordered = (rows ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({ type: row.mediaType, url: resolvePublicMediaUrl(row.url) }));

  if (ordered.length > 0) {
    return ordered;
  }

  if (imagePath) {
    return [{ type: "image", url: resolvePublicMediaUrl(imagePath) }];
  }

  return [];
}

export function resolvePrimaryImagePath(media: ProductMediaItem[], imagePath: string | null | undefined) {
  const firstImage = media.find((item) => item.type === "image");
  return firstImage?.url ?? (imagePath ? resolvePublicMediaUrl(imagePath) : null);
}

export function resolveHoverImagePath(hoverImagePath: string | null | undefined) {
  return hoverImagePath ? resolvePublicMediaUrl(hoverImagePath) : null;
}

export async function loadMediaRows(productIds: number[]) {
  if (productIds.length === 0) {
    return new Map<number, Array<{ mediaType: "image" | "video"; url: string; sortOrder: number }>>();
  }

  const rows = await db
    .select({
      productId: productMedia.productId,
      mediaType: productMedia.mediaType,
      url: productMedia.url,
      sortOrder: productMedia.sortOrder
    })
    .from(productMedia)
    .where(inArray(productMedia.productId, productIds))
    .orderBy(asc(productMedia.sortOrder), asc(productMedia.id));

  const byProduct = new Map<number, Array<{ mediaType: "image" | "video"; url: string; sortOrder: number }>>();
  for (const row of rows) {
    const list = byProduct.get(row.productId) ?? [];
    list.push(row);
    byProduct.set(row.productId, list);
  }
  return byProduct;
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replaceProductMediaWithin(tx: DbTransaction, productId: number, media: ProductMediaItem[]) {
  await tx.delete(productMedia).where(eq(productMedia.productId, productId));
  if (media.length === 0) {
    return;
  }

  await tx.insert(productMedia).values(
    media.map((item, index) => ({
      productId,
      mediaType: item.type,
      url: item.url,
      sortOrder: index + 1
    }))
  );
}

/**
 * Replaces a product's media atomically. When called inside an existing transaction, pass
 * `executor` so the delete+insert join the caller's transaction (e.g. the product update);
 * otherwise it runs in its own transaction.
 */
export async function replaceProductMediaRepo(
  productId: number,
  media: ProductMediaItem[],
  executor?: DbTransaction
) {
  if (executor) {
    await replaceProductMediaWithin(executor, productId, media);
  } else {
    await db.transaction((tx) => replaceProductMediaWithin(tx, productId, media));
  }
}

export async function addVariantRepo(input: {
  productId: number;
  sizeLabel: string;
  sellingPrice: number;
  stockQty: number;
}) {
  const [row] = await db
    .select({ maxSortOrder: sql<number | null>`max(${productVariants.sortOrder})` })
    .from(productVariants)
    .where(eq(productVariants.productId, input.productId));

  await db.insert(productVariants).values({
    productId: input.productId,
    sizeLabel: normalizeVariantSizeLabel(input.sizeLabel),
    sellingPrice: sql`${input.sellingPrice}`,
    stockQty: input.stockQty,
    sortOrder: Number(row?.maxSortOrder ?? 0) + 1
  });
}
