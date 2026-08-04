import { eq, inArray, sql } from "drizzle-orm";
import { productVariants, variantDiscounts } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  loadEntityMediaRows,
  normalizeEntityMedia,
  replaceEntityMediaRepo,
  resolvePublicEntityMediaUrl,
  resolvePrimaryEntityImagePath,
  type EntityMediaItem
} from "../entity-media.repository.js";

export type ProductMediaItem = EntityMediaItem;

export type VariantDiscountRecord = {
  id: number;
  variantId: number;
  type: "percentage" | "fixed";
  value: number;
  startsAt: string;
  endsAt: string;
  status: "active" | "inactive";
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
}, discount?: VariantDiscountRecord | null) {
  return {
    id: v.id,
    productId: v.productId,
    size: v.sizeLabel,
    price: toNumber(v.sellingPrice),
    stock: v.stockQty,
    sortOrder: v.sortOrder,
    discount: discount ?? null
  };
}

export const normalizeMedia = normalizeEntityMedia;
export const resolvePrimaryImagePath = resolvePrimaryEntityImagePath;

export function resolveHoverImagePath(hoverImagePath: string | null | undefined) {
  return hoverImagePath ? resolvePublicEntityMediaUrl(hoverImagePath) : null;
}

export async function loadMediaRows(productIds: number[]) {
  return loadEntityMediaRows("product", productIds);
}

export async function loadVariantDiscountRows(variantIds: number[]) {
  if (variantIds.length === 0) {
    return new Map<number, VariantDiscountRecord>();
  }

  const rows = await db
    .select({
      id: variantDiscounts.id,
      variantId: variantDiscounts.variantId,
      type: variantDiscounts.type,
      value: variantDiscounts.value,
      startsAt: variantDiscounts.startsAt,
      endsAt: variantDiscounts.endsAt,
      status: variantDiscounts.status
    })
    .from(variantDiscounts)
    .where(inArray(variantDiscounts.variantId, variantIds));

  return new Map(rows.map((row) => [
    row.variantId,
    {
      id: row.id,
      variantId: row.variantId,
      type: row.type,
      value: toNumber(row.value),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status
    }
  ]));
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  await replaceEntityMediaRepo({ type: "product", id: productId }, media, executor);
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
