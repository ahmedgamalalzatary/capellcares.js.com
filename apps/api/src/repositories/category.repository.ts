import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { compareByScopedOrdering, type OrderingSurface } from "@capella/shared";
import {
  categories,
  categoryPaths,
  entityOrderings,
  products
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { collectBranchIds, collectDescendantIds } from "./category-tree.js";
import { assertCompleteOrderedIds, replaceScopedOrderingRepo } from "./entity-ordering.repository.js";

type CategoryDbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export async function listCategoriesRepo(includeDeleted = false, surface: OrderingSurface = "erp") {
  const rows = await db
    .select()
    .from(categories)
    .where(includeDeleted ? undefined : isNull(categories.deletedAt));
  const scopeIds = [...new Set(rows.map((row) => row.parentId).filter((parentId): parentId is number => parentId != null))];
  const orderingRows = await db
    .select({
      scopeType: entityOrderings.scopeType,
      scopeId: entityOrderings.scopeId,
      entityId: entityOrderings.entityId,
      rank: entityOrderings.rank
    })
    .from(entityOrderings)
    .where(
      and(
        eq(entityOrderings.entityType, "category"),
        or(
          and(eq(entityOrderings.scopeType, "root"), isNull(entityOrderings.scopeId)),
          scopeIds.length > 0
            ? and(eq(entityOrderings.scopeType, "category"), inArray(entityOrderings.scopeId, scopeIds))
            : undefined
        )
      )
    );

  const rankByCategoryId = new Map<number, number>();
  for (const row of orderingRows) {
    rankByCategoryId.set(row.entityId, row.rank);
  }

  return rows
    .map((row) => ({
      ...row,
      sortOrder: rankByCategoryId.get(row.id)
    }))
    .sort(compareByScopedOrdering.bind(null, surface));
}

function categoryParentScopeCondition(parentId: number | null) {
  return parentId == null ? isNull(categories.parentId) : eq(categories.parentId, parentId);
}

export type CategoryWriteInput = {
  id?: number;
  parentId: number | null;
  slug: string;
  arName: string;
  enName: string;
  imagePath: string | null;
  isLeaf: boolean;
};

export type CategoryNode = {
  id: number;
  parentId: number | null;
  arName: string;
  enName: string;
  imagePath?: string | null;
  deletedAt: Date | null;
};

export async function getCategoryByIdRepo(id: number) {
  return db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function loadCategoryNodesRepo(): Promise<CategoryNode[]> {
  return db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      arName: categories.arName,
      enName: categories.enName,
      imagePath: categories.imagePath,
      deletedAt: categories.deletedAt
    })
    .from(categories);
}

// Persists a category (insert or update) and keeps the closure table and
// parents' leaf flags in sync. Assumes the caller (the service) has already
// enforced the business rules.
export async function writeCategoryRepo(
  input: CategoryWriteInput,
  previousParentId: number | null
): Promise<{ id: number }> {
  if (input.id) {
    await db
      .update(categories)
      .set({
        parentId: input.parentId,
        slug: input.slug,
        arName: input.arName,
        enName: input.enName,
        imagePath: input.imagePath,
        isLeaf: input.isLeaf
      })
      .where(eq(categories.id, input.id));
    await rebuildCategoryPathsRepo();
    await syncCategoryLeafState(previousParentId);
    await syncCategoryLeafState(input.parentId);
    return { id: input.id };
  }
  const [created] = await db
    .insert(categories)
    .values({
      parentId: input.parentId,
      slug: input.slug,
      arName: input.arName,
      enName: input.enName,
      imagePath: input.imagePath,
      isLeaf: input.isLeaf
    })
    .$returningId();
  await rebuildCategoryPathsRepo();
  await syncCategoryLeafState(input.parentId);
  return created;
}

export async function reorderCategoriesRepo(input: { parentId: number | null; ids: number[] }) {
  const { parentId, ids } = input;
  const roots = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(categoryParentScopeCondition(parentId), isNull(categories.deletedAt)));

  assertCompleteOrderedIds({
    requestedIds: ids,
    scopeEntityIds: roots.map((row) => row.id),
    errorCode: "INVALID_ROOT_ORDER",
    errorMessage: "Root category order is invalid"
  });

  await replaceScopedOrderingRepo({
    scopeType: parentId == null ? "root" : "category",
    scopeId: parentId,
    entityType: "category",
    ids
  });
}

export async function softDeleteCategoryRepo(id: number) {
  const [existing] = await db.select({ parentId: categories.parentId }).from(categories).where(eq(categories.id, id)).limit(1);
  await db.update(categories).set({ deletedAt: sql`NOW()` }).where(eq(categories.id, id));
  await rebuildCategoryPathsRepo();
  await syncCategoryLeafState(existing?.parentId ?? null);
}

export async function restoreCategoryRepo(id: number) {
  const [existing] = await db.select({ parentId: categories.parentId }).from(categories).where(eq(categories.id, id)).limit(1);
  await db.update(categories).set({ deletedAt: null }).where(eq(categories.id, id));
  await rebuildCategoryPathsRepo();
  await syncCategoryLeafState(existing?.parentId ?? null);
}

export async function hardDeleteCategoryRepo(id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ parentId: categories.parentId, deletedAt: categories.deletedAt })
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing || existing.deletedAt == null) {
      return false;
    }

    await tx
      .delete(entityOrderings)
      .where(
        or(
          and(eq(entityOrderings.entityType, "category"), eq(entityOrderings.entityId, id)),
          and(eq(entityOrderings.scopeType, "category"), eq(entityOrderings.scopeId, id))
        )
      );
    await tx.delete(categories).where(eq(categories.id, id));
    await rebuildCategoryPathsRepo(tx);
    await syncCategoryLeafState(existing.parentId, tx);
    return true;
  });
}

// Descendant lookup with a single source of truth: the categoryPaths closure
// table (rebuilt on every write, and self-inclusive). The in-memory fallback
// covers states where paths haven't been materialised yet (e.g. fresh seeds).
async function descendantCategoryIds(ancestorId: number): Promise<number[]> {
  const rows = await db
    .select({ id: categoryPaths.descendantId })
    .from(categoryPaths)
    .where(eq(categoryPaths.ancestorId, ancestorId));
  if (rows.length > 0) {
    return rows.map((row) => row.id);
  }
  const allCategories = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories);
  return collectDescendantIds(ancestorId, allCategories);
}

export async function listDescendantCategoryIdsRepo(ancestorId: number) {
  return descendantCategoryIds(ancestorId);
}

export async function listCategoryBranchIdsRepo(categoryId: number) {
  const allCategories = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(isNull(categories.deletedAt));
  return collectBranchIds(categoryId, allCategories);
}

export async function hasLinkedProductsInCategoryRepo(id: number) {
  const descendantIds = await descendantCategoryIds(id);
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(inArray(products.categoryId, descendantIds), isNull(products.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

export async function hasActiveChildrenCategoriesRepo(id: number) {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.parentId, id), isNull(categories.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

async function syncCategoryLeafState(parentId: number | null, executor: CategoryDbExecutor = db) {
  if (parentId == null) return;

  const hasActiveChildren = await executor
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.parentId, parentId), isNull(categories.deletedAt)))
    .limit(1)
    .then((rows) => rows.length > 0);
  await executor
    .update(categories)
    .set({ isLeaf: !hasActiveChildren })
    .where(eq(categories.id, parentId));
}

export async function findSiblingSlugConflictRepo(input: {
  id?: number;
  parentId: number | null;
  slug: string;
}) {
  return db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        input.parentId == null ? isNull(categories.parentId) : eq(categories.parentId, input.parentId),
        eq(categories.slug, input.slug),
        input.id ? ne(categories.id, input.id) : undefined
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

// Deliberately rebuilds the entire closure table on every write. The category
// tree is small (tens of rows), so a full truncate-and-reinsert is simpler and
// safer than computing incremental path deltas. Revisit only if the tree grows
// large enough for this to matter.
async function rebuildCategoryPathsRepo(executor: CategoryDbExecutor = db) {
  const rows = await executor
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const pathRows: Array<{ ancestorId: number; descendantId: number; depth: number }> = [];

  for (const row of rows) {
    const seen = new Set<number>();
    let currentId: number | null = row.id;
    let depth = 0;

    while (currentId != null && !seen.has(currentId)) {
      seen.add(currentId);
      pathRows.push({
        ancestorId: currentId,
        descendantId: row.id,
        depth
      });
      currentId = byId.get(currentId)?.parentId ?? null;
      depth += 1;
    }
  }

  if (executor === db) {
    await db.transaction(async (tx) => {
      await tx.delete(categoryPaths);
      if (pathRows.length > 0) {
        await tx.insert(categoryPaths).values(pathRows);
      }
    });
    return;
  }

  await executor.delete(categoryPaths);
  if (pathRows.length > 0) {
    await executor.insert(categoryPaths).values(pathRows);
  }
}

export async function findSameParentGrandchildNameConflictRepo(input: {
  id?: number;
  parentId: number | null;
  arName: string;
  enName: string;
}) {
  if (input.parentId == null) {
    return null;
  }

  return db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.parentId, input.parentId),
        isNull(categories.deletedAt),
        or(eq(categories.arName, input.arName), eq(categories.enName, input.enName)),
        input.id ? ne(categories.id, input.id) : undefined
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
