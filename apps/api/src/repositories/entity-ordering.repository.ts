import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  entityOrderings,
  orderingEntityTypes,
  orderingScopeTypes,
  productVariants
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

type ScopeType = (typeof orderingScopeTypes)[number];
type EntityType = (typeof orderingEntityTypes)[number];
type DbExecutor = Pick<typeof db, "delete" | "insert" | "select">;

export function assertCompleteOrderedIds(input: {
  requestedIds: number[];
  scopeEntityIds: number[];
  errorCode: string;
  errorMessage: string;
}) {
  const { requestedIds, scopeEntityIds, errorCode, errorMessage } = input;
  const requested = [...requestedIds].sort((a, b) => a - b);
  const existing = [...scopeEntityIds].sort((a, b) => a - b);
  const sameIds =
    requestedIds.length > 0 &&
    new Set(requestedIds).size === requestedIds.length &&
    requested.length === existing.length &&
    requested.every((id, index) => id === existing[index]);

  if (!sameIds) {
    const error = new Error(errorMessage);
    (error as Error & { code?: string }).code = errorCode;
    throw error;
  }
}

export async function replaceScopedOrderingRepo(
  input: {
    scopeType: ScopeType;
    scopeId: number | null;
    entityType: EntityType;
    ids: number[];
  },
  executor?: DbExecutor
) {
  const { scopeType, scopeId, entityType, ids } = input;
  const run = async (tx: DbExecutor) => {
    await tx
      .delete(entityOrderings)
      .where(
        and(
          eq(entityOrderings.scopeType, scopeType),
          scopeId == null ? isNull(entityOrderings.scopeId) : eq(entityOrderings.scopeId, scopeId),
          eq(entityOrderings.entityType, entityType)
        )
      );

    if (ids.length > 0) {
      await tx.insert(entityOrderings).values(
        ids.map((id, index) => ({
          scopeType,
          scopeId,
          entityType,
          entityId: id,
          rank: index + 1
        }))
      );
    }
  };

  if (executor) {
    await run(executor);
    return;
  }

  await db.transaction(run);
}

// The payload's item order is the bundle's product order; variants of the same
// product collapse onto the product's first occurrence.
export async function orderedProductIdsForVariants(
  tx: Pick<typeof db, "select">,
  variantIds: number[]
) {
  if (variantIds.length === 0) {
    return [];
  }
  const variantRows = await tx
    .select({ id: productVariants.id, productId: productVariants.productId })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds));
  const productIdByVariantId = new Map(variantRows.map((row) => [row.id, row.productId]));
  const orderedProductIds: number[] = [];
  for (const variantId of variantIds) {
    const productId = productIdByVariantId.get(variantId);
    if (productId != null && !orderedProductIds.includes(productId)) {
      orderedProductIds.push(productId);
    }
  }
  return orderedProductIds;
}

export async function loadScopedRanksRepo(input: {
  scopeType: ScopeType;
  scopeId: number | null;
  entityType: EntityType;
  entityIds?: number[];
}) {
  const { scopeType, scopeId, entityType, entityIds } = input;
  if (entityIds && entityIds.length === 0) {
    return new Map<number, number>();
  }

  const rows = await db
    .select({ entityId: entityOrderings.entityId, rank: entityOrderings.rank })
    .from(entityOrderings)
    .where(
      and(
        eq(entityOrderings.scopeType, scopeType),
        scopeId == null ? isNull(entityOrderings.scopeId) : eq(entityOrderings.scopeId, scopeId),
        eq(entityOrderings.entityType, entityType),
        entityIds ? inArray(entityOrderings.entityId, entityIds) : undefined
      )
    );

  return new Map(rows.map((row) => [row.entityId, row.rank]));
}
