import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { compareByScopedOrdering, type OrderingSurface } from "@capella/shared";
import {
  categories,
  categoryPaths,
  entityOrderings,
  orderingEntityTypes,
  orderingScopeTypes,
  products
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

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

export async function upsertCategoryRepo(input: {
  id?: number;
  parentId: number | null;
  slug: string;
  arName: string;
  enName: string;
  isLeaf: boolean;
}) {
  const previous = input.id
    ? await db
        .select({ id: categories.id, parentId: categories.parentId })
        .from(categories)
        .where(eq(categories.id, input.id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;
  const allCategories = await db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      arName: categories.arName,
      enName: categories.enName,
      deletedAt: categories.deletedAt
    })
    .from(categories);

  if (input.id && wouldCreateCategoryCycle(input.id, input.parentId, allCategories)) {
    const error = new Error("Category parent cannot be the category itself or one of its descendants");
    (error as Error & { code?: string }).code = "CATEGORY_INVALID_PARENT";
    throw error;
  }

  const slugConflict = await findSiblingSlugConflict({
    id: input.id,
    parentId: input.parentId,
    slug: input.slug
  });

  if (slugConflict) {
    const error = new Error("Category slug already exists under this parent");
    (error as Error & { code?: string }).code = "CATEGORY_SLUG_CONFLICT";
    throw error;
  }

  const lineage = buildCategoryLineage(input.parentId, allCategories);
  const isGrandchildCategory = lineage.length === 2;

  if (isGrandchildCategory) {
    const conflict = await findSameParentGrandchildNameConflict({
      id: input.id,
      parentId: input.parentId,
      arName: input.arName,
      enName: input.enName
    });

    if (conflict) {
      const error = new Error("Category name already exists under this parent");
      (error as Error & { code?: string }).code = "CATEGORY_NAME_CONFLICT";
      throw error;
    }
  }

  if (input.id) {
    await db
      .update(categories)
      .set({
        parentId: input.parentId,
        slug: input.slug,
        arName: input.arName,
        enName: input.enName,
        isLeaf: input.isLeaf
      })
      .where(eq(categories.id, input.id));
    await rebuildCategoryPathsRepo();
    await syncCategoryLeafState(previous?.parentId ?? null);
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
      isLeaf: input.isLeaf
    })
    .$returningId();
  await rebuildCategoryPathsRepo();
  await syncCategoryLeafState(input.parentId);
  return created;
}

export async function reorderCategoriesRepo(input: { parentId: number | null; ids: number[] }) {
  const { parentId, ids } = input;
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    const error = new Error("Root category order is invalid");
    (error as Error & { code?: string }).code = "INVALID_ROOT_ORDER";
    throw error;
  }

  const roots = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(categoryParentScopeCondition(parentId), isNull(categories.deletedAt)));

  const rootIds = roots.map((row) => row.id);
  if (rootIds.length !== ids.length) {
    const error = new Error("Root category order is incomplete");
    (error as Error & { code?: string }).code = "INVALID_ROOT_ORDER";
    throw error;
  }

  const requestedIds = [...ids].sort((a, b) => a - b);
  const existingIds = [...rootIds].sort((a, b) => a - b);
  const sameIds = requestedIds.every((id, index) => id === existingIds[index]);
  if (!sameIds) {
    const error = new Error("Root category order references invalid ids");
    (error as Error & { code?: string }).code = "INVALID_ROOT_ORDER";
    throw error;
  }

  await db.transaction(async (tx) => {
    const scopeType: (typeof orderingScopeTypes)[number] = parentId == null ? "root" : "category";
    const entityType: (typeof orderingEntityTypes)[number] = "category";
    await tx
      .delete(entityOrderings)
      .where(
        and(
          eq(entityOrderings.scopeType, scopeType),
          parentId == null ? isNull(entityOrderings.scopeId) : eq(entityOrderings.scopeId, parentId),
          eq(entityOrderings.entityType, entityType)
        )
      );

    await tx.insert(entityOrderings).values(
      ids.map((id, index) => ({
        scopeType,
        scopeId: parentId,
        entityType,
        entityId: id,
        rank: index + 1
      }))
    );
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

export async function listDescendantCategoryIdsRepo(ancestorId: number) {
  const rows = await db
    .select({ id: categoryPaths.descendantId })
    .from(categoryPaths)
    .where(eq(categoryPaths.ancestorId, ancestorId));
  if (rows.length === 0) {
    const allCategories = await db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories);
    const descendantIds = new Set<number>([ancestorId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const category of allCategories) {
        if (
          category.parentId != null &&
          descendantIds.has(category.parentId) &&
          !descendantIds.has(category.id)
        ) {
          descendantIds.add(category.id);
          changed = true;
        }
      }
    }

    return [...descendantIds];
  }
  return rows.map((row) => row.id);
}

export async function hasLinkedProductsInCategoryRepo(id: number) {
  const allCategories = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories);
  const descendantIds = new Set<number>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of allCategories) {
      if (c.parentId != null && descendantIds.has(c.parentId) && !descendantIds.has(c.id)) {
        descendantIds.add(c.id);
        changed = true;
      }
    }
  }
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(sql`${products.categoryId} in (${sql.join([...descendantIds].map((x) => sql`${x}`), sql`,`)})`, isNull(products.deletedAt)))
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

async function syncCategoryLeafState(parentId: number | null) {
  if (parentId == null) return;

  const hasActiveChildren = await hasActiveChildrenCategoriesRepo(parentId);
  await db
    .update(categories)
    .set({ isLeaf: !hasActiveChildren })
    .where(eq(categories.id, parentId));
}

async function findSiblingSlugConflict(input: {
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

async function rebuildCategoryPathsRepo() {
  const rows = await db
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

  await db.transaction(async (tx) => {
    await tx.delete(categoryPaths);
    if (pathRows.length > 0) {
      await tx.insert(categoryPaths).values(pathRows);
    }
  });
}

function buildCategoryLineage(
  parentId: number | null,
  rows: Array<{
    id: number;
    parentId: number | null;
  }>
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const lineage: typeof rows = [];
  const seen = new Set<number>();
  let currentParentId = parentId;

  while (currentParentId != null && !seen.has(currentParentId)) {
    seen.add(currentParentId);
    const current = byId.get(currentParentId);
    if (!current) {
      break;
    }
    lineage.unshift(current);
    currentParentId = current.parentId;
  }

  return lineage;
}

function wouldCreateCategoryCycle(
  categoryId: number,
  nextParentId: number | null,
  rows: Array<{ id: number; parentId: number | null }>
) {
  if (nextParentId == null) {
    return false;
  }

  if (nextParentId === categoryId) {
    return true;
  }

  const childrenByParentId = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parentId == null) {
      continue;
    }

    const children = childrenByParentId.get(row.parentId) ?? [];
    children.push(row.id);
    childrenByParentId.set(row.parentId, children);
  }

  const stack = [categoryId];
  const descendants = new Set<number>();
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const children = childrenByParentId.get(currentId) ?? [];
    for (const childId of children) {
      if (descendants.has(childId)) {
        continue;
      }
      descendants.add(childId);
      stack.push(childId);
    }
  }

  return descendants.has(nextParentId);
}

async function findSameParentGrandchildNameConflict(input: {
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
