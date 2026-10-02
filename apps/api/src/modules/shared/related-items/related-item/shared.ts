import { and, eq, sql } from "drizzle-orm";
import { relatedItems } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import type { RatingSummary } from "@capella/shared";

export type RelatedEntityType = "product" | "offer" | "collection";

export interface RelatedRef {
  type: RelatedEntityType;
  id: number;
}

export interface StorefrontRelatedCard {
  type: RelatedEntityType;
  id: number;
  /** Average stars and review count for the card; zeroed when unreviewed. */
  rating: RatingSummary;
  slug: string;
  name: { ar: string; en: string };
  imagePath: string | null;
  price: number;
  /**
   * The variant the card transacts on — the cheapest in-stock one. Null for
   * offers and collections, which the cart addresses by their own id.
   */
  variantId: number | null;
  /**
   * Price before the saving: a product's pre-discount selling price, or a
   * bundle's sum of parts. Null when the card is not discounted.
   */
  originalTotal: number | null;
  /**
   * Classification line shown under a product's name. Null for offers and
   * collections, whose cards carry no category line.
   */
  categoryName: { ar: string; en: string } | null;
}

export type RelatedItemExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export function sameRef(a: RelatedRef, b: RelatedRef): boolean {
  return a.type === b.type && a.id === b.id;
}

export async function nextRankForSource(
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

export async function deleteLink(executor: RelatedItemExecutor, source: RelatedRef, target: RelatedRef): Promise<void> {
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
