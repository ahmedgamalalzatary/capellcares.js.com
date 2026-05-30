import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { offers, productVariants, products, relatedItems } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export type RelatedEntityType = "product" | "offer" | "collection";

export interface RelatedRef {
  type: RelatedEntityType;
  id: number;
}

export interface StorefrontRelatedCard {
  type: RelatedEntityType;
  id: number;
  slug: string;
  name: { ar: string; en: string };
  imagePath: string | null;
  price: number;
}

type RelatedItemExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

function sameRef(a: RelatedRef, b: RelatedRef): boolean {
  return a.type === b.type && a.id === b.id;
}

async function nextRankForSource(
  executor: RelatedItemExecutor,
  sourceType: RelatedEntityType,
  sourceId: number
): Promise<number> {
  const [row] = await executor
    .select({ maxRank: sql<number | null>`max(${relatedItems.rank})` })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, sourceType), eq(relatedItems.sourceId, sourceId)));
  return Number(row?.maxRank ?? 0) + 1;
}

async function linkExists(executor: RelatedItemExecutor, source: RelatedRef, target: RelatedRef): Promise<boolean> {
  const [row] = await executor
    .select({ id: relatedItems.id })
    .from(relatedItems)
    .where(
      and(
        eq(relatedItems.sourceType, source.type),
        eq(relatedItems.sourceId, source.id),
        eq(relatedItems.targetType, target.type),
        eq(relatedItems.targetId, target.id)
      )
    )
    .limit(1);
  return Boolean(row);
}

async function deleteLink(executor: RelatedItemExecutor, source: RelatedRef, target: RelatedRef): Promise<void> {
  await executor
    .delete(relatedItems)
    .where(
      and(
        eq(relatedItems.sourceType, source.type),
        eq(relatedItems.sourceId, source.id),
        eq(relatedItems.targetType, target.type),
        eq(relatedItems.targetId, target.id)
      )
    );
}

/**
 * Reconciles a source entity's related list to exactly `targets`, in the given
 * order. This is the single mutation entry point used by upserts and the ERP
 * editor:
 *
 * - The source's rank for each target is the target's position (1-based).
 * - New links also create their mirror row, appended to the target's own list
 *   (per-source ranking — the mirror's rank is independent of this side).
 * - Links dropped from `targets` are unlinked in BOTH directions.
 * - Self-references are rejected.
 */
export async function setRelatedLinksForSourceRepo(
  source: RelatedRef,
  targets: RelatedRef[]
): Promise<void> {
  for (const target of targets) {
    if (sameRef(source, target)) {
      throw new Error("related-item-self-reference");
    }
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId })
      .from(relatedItems)
      .where(and(eq(relatedItems.sourceType, source.type), eq(relatedItems.sourceId, source.id)));

    // Remove links (both directions) that are no longer desired.
    for (const row of existing) {
      const stillWanted = targets.some((target) => sameRef(target, { type: row.targetType, id: row.targetId }));
      if (!stillWanted) {
        const target = { type: row.targetType, id: row.targetId };
        await deleteLink(tx, source, target);
        await deleteLink(tx, target, source);
      }
    }

    // Upsert each desired link with its source-side rank = position.
    for (let index = 0; index < targets.length; index++) {
      const target = targets[index];
      const rank = index + 1;

      if (await linkExists(tx, source, target)) {
        await tx
          .update(relatedItems)
          .set({ rank })
          .where(
            and(
              eq(relatedItems.sourceType, source.type),
              eq(relatedItems.sourceId, source.id),
              eq(relatedItems.targetType, target.type),
              eq(relatedItems.targetId, target.id)
            )
          );
      } else {
        await tx.insert(relatedItems).values({
          sourceType: source.type,
          sourceId: source.id,
          targetType: target.type,
          targetId: target.id,
          rank
        });
      }

      // Ensure the mirror row exists, appended to the target's own list.
      if (!(await linkExists(tx, target, source))) {
        await tx.insert(relatedItems).values({
          sourceType: target.type,
          sourceId: target.id,
          targetType: source.type,
          targetId: source.id,
          rank: await nextRankForSource(tx, target.type, target.id)
        });
      }
    }
  });
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
    const card = ref.type === "product" ? productCards.get(ref.id) : ref.type === "offer" ? offerCards.get(ref.id) : undefined;
    return card ? [card] : [];
  });
}

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
