import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { productColors, productMedia, productSizes, productVariants } from "@minikoshk/database/drizzle/schema";
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
  sizeId: number;
  colorId: number | null;
  sellingPrice: unknown;
  stockQty: number;
  sortOrder: number;
}) {
  return {
    id: v.id,
    productId: v.productId,
    sizeId: v.sizeId,
    colorId: v.colorId,
    price: toNumber(v.sellingPrice),
    stock: v.stockQty,
    sortOrder: v.sortOrder
  };
}

export function mapSize(size: {
  id: number;
  productId: number;
  sizeLabel: string;
  sortOrder: number;
}) {
  return {
    id: size.id,
    productId: size.productId,
    label: size.sizeLabel,
    sortOrder: size.sortOrder
  };
}

export function mapColor(color: {
  id: number;
  productId: number;
  colorHex: string;
  sortOrder: number;
}) {
  return {
    id: color.id,
    productId: color.productId,
    hex: color.colorHex,
    sortOrder: color.sortOrder
  };
}

export async function loadProductOptions(productIds: number[]) {
  const sizesByProduct = new Map<number, ReturnType<typeof mapSize>[]>();
  const colorsByProduct = new Map<number, ReturnType<typeof mapColor>[]>();
  if (productIds.length === 0) return { sizesByProduct, colorsByProduct };

  const [sizeRows, colorRows] = await Promise.all([
    db.select({
      id: productSizes.id,
      productId: productSizes.productId,
      sizeLabel: productSizes.sizeLabel,
      sortOrder: productSizes.sortOrder
    }).from(productSizes)
      .where(and(inArray(productSizes.productId, productIds), isNull(productSizes.deletedAt)))
      .orderBy(asc(productSizes.sortOrder), asc(productSizes.id)),
    db.select({
      id: productColors.id,
      productId: productColors.productId,
      colorHex: productColors.colorHex,
      sortOrder: productColors.sortOrder
    }).from(productColors)
      .where(and(inArray(productColors.productId, productIds), isNull(productColors.deletedAt)))
      .orderBy(asc(productColors.sortOrder), asc(productColors.id))
  ]);

  for (const row of sizeRows) {
    const items = sizesByProduct.get(row.productId) ?? [];
    items.push(mapSize(row));
    sizesByProduct.set(row.productId, items);
  }
  for (const row of colorRows) {
    const items = colorsByProduct.get(row.productId) ?? [];
    items.push(mapColor(row));
    colorsByProduct.set(row.productId, items);
  }
  return { sizesByProduct, colorsByProduct };
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
  const [row] = await db.select({ maxSortOrder: sql<number | null>`max(${productSizes.sortOrder})` })
    .from(productSizes).where(eq(productSizes.productId, input.productId));
  const sortOrder = Number(row?.maxSortOrder ?? 0) + 1;
  const [size] = await db.insert(productSizes).values({
    productId: input.productId,
    sizeLabel: normalizeVariantSizeLabel(input.sizeLabel),
    sortOrder
  }).$returningId();
  await db.insert(productVariants).values({
    productId: input.productId,
    sizeId: size.id,
    sellingPrice: sql`${input.sellingPrice}`,
    stockQty: input.stockQty,
    sortOrder
  });
}
