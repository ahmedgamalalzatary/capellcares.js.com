import { and, eq } from "drizzle-orm";
import { relatedItems } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  deleteLink,
  linkExists,
  nextRankForSource,
  sameRef,
  type RelatedRef
} from "./shared.js";

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

    for (const row of existing) {
      const stillWanted = targets.some((target) => sameRef(target, { type: row.targetType, id: row.targetId }));
      if (!stillWanted) {
        const target = { type: row.targetType, id: row.targetId };
        await deleteLink(tx, source, target);
        await deleteLink(tx, target, source);
      }
    }

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
