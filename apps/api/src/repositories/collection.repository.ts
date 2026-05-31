import { eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { collectionItems, collections } from "@capella/database/drizzle/schema";

function mergeCollectionItems(items: Array<{ id?: number; variantId: number; qty: number }>) {
  const merged = new Map<number, { id?: number; variantId: number; qty: number }>();

  for (const item of items) {
    const current = merged.get(item.variantId);
    if (current) {
      current.qty += item.qty;
      if (!current.id && item.id) {
        current.id = item.id;
      }
      continue;
    }

    merged.set(item.variantId, { ...item });
  }

  return [...merged.values()];
}

export async function listCollectionsRepo(includeDeleted = false) {
  const rows = await db.select().from(collections).where(includeDeleted ? undefined : isNull(collections.deletedAt));
  return Promise.all(
    rows.map(async (row) => {
      const items = await db.select().from(collectionItems).where(eq(collectionItems.collectionId, row.id));
      return { ...row, items };
    })
  );
}

export async function listVisibleCollectionsRepo() {
  const rows = await db
    .select()
    .from(collections)
    .where(
      sql`${collections.visibility} = 'visible' and ${collections.status} = 'active' and ${collections.deletedAt} is null`
    );
  return Promise.all(
    rows.map(async (row) => {
      const items = await db.select().from(collectionItems).where(eq(collectionItems.collectionId, row.id));
      return { ...row, items };
    })
  );
}

export async function findCollectionBySlugRepo(slug: string) {
  const [row] = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
  if (!row) return null;
  if (row.deletedAt || row.visibility !== "visible" || row.status !== "active") return null;
  const items = await db.select().from(collectionItems).where(eq(collectionItems.collectionId, row.id));
  return { ...row, items };
}

export async function upsertCollectionRepo(input: {
  id?: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription?: string | null;
  enDescription?: string | null;
  imagePath?: string | null;
  fixedPrice: number;
  categoryId: number;
  status: "active" | "inactive";
  visibility?: "visible" | "hidden";
  items: Array<{ id?: number; variantId: number; qty: number }>;
}) {
  const mergedItems = mergeCollectionItems(input.items);
  let collectionId = input.id;
  if (collectionId) {
    await db
      .update(collections)
      .set({
        slug: input.slug,
        arName: input.arName,
        enName: input.enName,
        arDescription: input.arDescription ?? null,
        enDescription: input.enDescription ?? null,
        imagePath: input.imagePath ?? null,
        fixedPrice: sql`${input.fixedPrice}`,
        categoryId: input.categoryId,
        status: input.status,
        visibility: input.visibility ?? "visible"
      })
      .where(eq(collections.id, collectionId));
  } else {
    const [created] = await db
      .insert(collections)
      .values({
        slug: input.slug,
        arName: input.arName,
        enName: input.enName,
        arDescription: input.arDescription ?? null,
        enDescription: input.enDescription ?? null,
        imagePath: input.imagePath ?? null,
        fixedPrice: sql`${input.fixedPrice}`,
        categoryId: input.categoryId,
        status: input.status,
        visibility: input.visibility ?? "visible"
      })
      .$returningId();
    collectionId = created.id;
  }

  const existingItems = await db
    .select({ id: collectionItems.id })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId!));
  const existingIds = existingItems.map((item) => item.id);
  const keptIds = mergedItems
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number" && existingIds.includes(id));

  if (existingIds.length > 0) {
    const removedIds = existingIds.filter((id) => !keptIds.includes(id));
    if (removedIds.length > 0) {
      await db.delete(collectionItems).where(inArray(collectionItems.id, removedIds));
    }
  }

  for (const item of mergedItems) {
    if (item.id && existingIds.includes(item.id)) {
      await db
        .update(collectionItems)
        .set({ variantId: item.variantId, qty: item.qty })
        .where(eq(collectionItems.id, item.id));
      continue;
    }

    await db.insert(collectionItems).values({ collectionId: collectionId!, variantId: item.variantId, qty: item.qty });
  }

  return { id: collectionId! };
}

export async function softDeleteCollectionRepo(id: number) {
  await db.update(collections).set({ deletedAt: sql`NOW()` }).where(eq(collections.id, id));
}

export async function restoreCollectionRepo(id: number) {
  await db.update(collections).set({ deletedAt: null }).where(eq(collections.id, id));
}

export async function toggleCollectionStatusRepo(id: number) {
  const [current] = await db.select({ status: collections.status }).from(collections).where(eq(collections.id, id)).limit(1);
  if (!current) return;
  await db
    .update(collections)
    .set({ status: current.status === "active" ? "inactive" : "active" })
    .where(eq(collections.id, id));
}
