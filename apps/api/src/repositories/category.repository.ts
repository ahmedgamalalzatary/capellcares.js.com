import { and, eq, isNull, sql } from "drizzle-orm";
import { categories, products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export function listCategoriesRepo(includeDeleted = false) {
  return db.select().from(categories).where(includeDeleted ? undefined : isNull(categories.deletedAt));
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
    ? await db.select({ id: categories.id, parentId: categories.parentId }).from(categories).where(eq(categories.id, input.id)).limit(1).then((rows) => rows[0] ?? null)
    : null;

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
  await syncCategoryLeafState(input.parentId);
  return created;
}

export async function softDeleteCategoryRepo(id: number) {
  const [existing] = await db.select({ parentId: categories.parentId }).from(categories).where(eq(categories.id, id)).limit(1);
  await db.update(categories).set({ deletedAt: sql`NOW()` }).where(eq(categories.id, id));
  await syncCategoryLeafState(existing?.parentId ?? null);
}

export async function restoreCategoryRepo(id: number) {
  const [existing] = await db.select({ parentId: categories.parentId }).from(categories).where(eq(categories.id, id)).limit(1);
  await db.update(categories).set({ deletedAt: null }).where(eq(categories.id, id));
  await syncCategoryLeafState(existing?.parentId ?? null);
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
