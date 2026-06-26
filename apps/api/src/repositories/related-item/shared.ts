import { and, eq, sql } from "drizzle-orm";
import { relatedItems } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";

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
