import { and, eq, sql } from "drizzle-orm";
import { relatedItems } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  deleteLink,
  nextRankForSource,
  sameRef,
  type RelatedRef
} from "./shared.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  targets: RelatedRef[],
  executor?: DbTransaction
): Promise<void> {
  const uniqueTargets = targets.filter((target, index) =>
    targets.findIndex((candidate) => sameRef(candidate, target)) === index
  );

  for (const target of uniqueTargets) {
    if (sameRef(source, target)) {
      throw new Error("related-item-self-reference");
    }
  }

  const run = async (tx: DbTransaction) => {
    const existing = await tx
      .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId })
      .from(relatedItems)
      .where(and(eq(relatedItems.sourceType, source.type), eq(relatedItems.sourceId, source.id)));

    for (const row of existing) {
      const stillWanted = uniqueTargets.some((target) => sameRef(target, { type: row.targetType, id: row.targetId }));
      if (!stillWanted) {
        const target = { type: row.targetType, id: row.targetId };
        await deleteLink(tx, source, target);
        await deleteLink(tx, target, source);
      }
    }

    for (let index = 0; index < uniqueTargets.length; index++) {
      const target = uniqueTargets[index];
      const rank = index + 1;

      await tx.insert(relatedItems).values({
        sourceType: source.type,
        sourceId: source.id,
        targetType: target.type,
        targetId: target.id,
        rank
      }).onDuplicateKeyUpdate({ set: { rank } });

      await tx.insert(relatedItems).values({
        sourceType: target.type,
        sourceId: target.id,
        targetType: source.type,
        targetId: source.id,
        rank: await nextRankForSource(tx, target.type, target.id)
      }).onDuplicateKeyUpdate({ set: { rank: sql`${relatedItems.rank}` } });
    }
  };

  if (executor) {
    await run(executor);
    return;
  }

  await db.transaction(run);
}
