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
  return created;
}

export async function softDeleteCategoryRepo(id: number) {
  await db.update(categories).set({ deletedAt: sql`NOW()` }).where(eq(categories.id, id));
}

export async function restoreCategoryRepo(id: number) {
  await db.update(categories).set({ deletedAt: null }).where(eq(categories.id, id));
}

export async function hasLinkedProductsInCategoryRepo(id: number) {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.categoryId, id), isNull(products.deletedAt)))
    .limit(1);
  return rows.length > 0;
}
