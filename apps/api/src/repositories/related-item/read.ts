import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { offers, productVariants, products, relatedItems } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import type { RelatedEntityType, RelatedRef, StorefrontRelatedCard } from "./shared.js";

/**
 * Returns a source entity's related targets in its own rank order.
 */
export async function listRelatedLinksForSourceRepo(
  sourceType: RelatedEntityType,
  sourceId: number
): Promise<RelatedRef[]> {
  const rows = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, sourceType), eq(relatedItems.sourceId, sourceId)))
    .orderBy(asc(relatedItems.rank), asc(relatedItems.id));
  return rows.map((row) => ({ type: row.targetType, id: row.targetId }));
}

/**
 * Hydrates a source entity's related targets into storefront cards, in this
 * source's rank order, filtered at read time:
 * - products: active, non-deleted, in-stock
 * - offers: active, non-deleted, visible
 * Filtered-out targets are dropped; remaining order (with gaps) is preserved.
 */
export async function getStorefrontRelatedCardsRepo(source: RelatedRef): Promise<StorefrontRelatedCard[]> {
  const ordered = await listRelatedLinksForSourceRepo(source.type, source.id);
  if (ordered.length === 0) {
    return [];
  }

  const productIds = ordered.filter((ref) => ref.type === "product").map((ref) => ref.id);
  const offerIds = ordered.filter((ref) => ref.type === "offer").map((ref) => ref.id);

  const productCards = new Map<number, StorefrontRelatedCard>();
  if (productIds.length > 0) {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        arName: products.arName,
        enName: products.enName,
        imagePath: products.imagePath
      })
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.status, "active"), isNull(products.deletedAt)));

    const variantRows = rows.length
      ? await db
          .select({
            productId: productVariants.productId,
            sellingPrice: productVariants.sellingPrice,
            stockQty: productVariants.stockQty
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, rows.map((row) => row.id)))
      : [];

    for (const row of rows) {
      const variants = variantRows.filter((variant) => variant.productId === row.id);
      const inStock = variants.some((variant) => variant.stockQty > 0);
      if (!inStock) {
        continue;
      }
      const price = variants.length
        ? Math.min(...variants.map((variant) => Number(variant.sellingPrice)))
        : 0;
      productCards.set(row.id, {
        type: "product",
        id: row.id,
        slug: row.slug,
        name: { ar: row.arName, en: row.enName },
        imagePath: row.imagePath ?? null,
        price
      });
    }
  }

  const offerCards = new Map<number, StorefrontRelatedCard>();
  if (offerIds.length > 0) {
    const rows = await db
      .select({
        id: offers.id,
        slug: offers.slug,
        arName: offers.arName,
        enName: offers.enName,
        imagePath: offers.imagePath,
        fixedPrice: offers.fixedPrice
      })
      .from(offers)
      .where(
        and(
          inArray(offers.id, offerIds),
          eq(offers.status, "active"),
          eq(offers.visibility, "visible"),
          isNull(offers.deletedAt)
        )
      );

    for (const row of rows) {
      offerCards.set(row.id, {
        type: "offer",
        id: row.id,
        slug: row.slug,
        name: { ar: row.arName, en: row.enName },
        imagePath: row.imagePath ?? null,
        price: Number(row.fixedPrice)
      });
    }
  }

  return ordered.flatMap((ref) => {
    // "collection" targets are intentionally not hydrated into storefront cards yet; they are dropped here.
    const card = ref.type === "product" ? productCards.get(ref.id) : ref.type === "offer" ? offerCards.get(ref.id) : undefined;
    return card ? [card] : [];
  });
}
