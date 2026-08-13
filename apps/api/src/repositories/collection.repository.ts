import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { compareByScopedOrdering, type Language, type OrderingSurface } from "@capella/shared";
import { db } from "@capella/database/src/db";
import { categories, collectionItems, collections, productVariants } from "@capella/database/drizzle/schema";
import {
  assertCompleteOrderedIds,
  loadScopedRanksForScopesRepo,
  loadScopedRanksRepo,
  orderedProductIdsForVariants,
  replaceScopedOrderingRepo
} from "./entity-ordering.repository.js";
import {
  loadEntityMediaRows,
  normalizeEntityMedia,
  replaceEntityMediaRepo,
  resolvePrimaryEntityImagePath,
  type EntityMediaItem
} from "./entity-media.repository.js";

async function withCollectionMedia<T extends { id: number; imagePath: string | null }>(rows: T[], lang: Language = "en") {
  const mediaByCollection = await loadEntityMediaRows("collection", rows.map((row) => row.id));
  return rows.map((row) => {
    const media = normalizeEntityMedia(mediaByCollection.get(row.id), row.imagePath);
    return { ...row, media, imagePath: resolvePrimaryEntityImagePath(media, row.imagePath, lang) };
  });
}

async function withCollectionRanks<T extends { id: number }>(rows: T[], surface: OrderingSurface) {
  const rankByCollectionId = await loadScopedRanksRepo({
    scopeType: "root",
    scopeId: null,
    entityType: "collection",
    entityIds: rows.map((row) => row.id)
  });
  return rows
    .map((row) => ({ ...row, sortOrder: rankByCollectionId.get(row.id) }))
    .sort(compareByScopedOrdering.bind(null, surface));
}

// Items inside one collection must read identically on both surfaces, so the
// erp fallback (older first) is used to keep legacy insertion order for
// items created before in-collection product ordering existed.
type CollectionItemRow = {
  id: number;
  collectionId: number;
  variantId: number;
  qty: number;
  createdAt: Date;
  productId: number;
};

function selectCollectionItemRows() {
  return db
    .select({
      id: collectionItems.id,
      collectionId: collectionItems.collectionId,
      variantId: collectionItems.variantId,
      qty: collectionItems.qty,
      createdAt: collectionItems.createdAt,
      productId: productVariants.productId
    })
    .from(collectionItems)
    .innerJoin(productVariants, eq(collectionItems.variantId, productVariants.id));
}

function orderCollectionItems(rows: CollectionItemRow[], rankByProductId: Map<number, number>) {
  return rows
    .map((row) => ({ ...row, sortOrder: rankByProductId.get(row.productId) }))
    .sort(compareByScopedOrdering.bind(null, "erp"));
}

async function listOrderedCollectionItemsRepo(collectionId: number) {
  const rows = await selectCollectionItemRows().where(eq(collectionItems.collectionId, collectionId));
  const rankByProductId = await loadScopedRanksRepo({
    scopeType: "collection",
    scopeId: collectionId,
    entityType: "product"
  });
  return orderCollectionItems(rows, rankByProductId);
}

/**
 * The same ordered items as `listOrderedCollectionItemsRepo`, for a whole page
 * of collections in two reads rather than two per collection.
 */
async function listOrderedItemsByCollectionRepo(collectionIds: number[]) {
  const itemsByCollectionId = new Map<number, ReturnType<typeof orderCollectionItems>>();
  if (collectionIds.length === 0) {
    return itemsByCollectionId;
  }

  const [rows, ranksByCollectionId] = await Promise.all([
    selectCollectionItemRows().where(inArray(collectionItems.collectionId, collectionIds)),
    loadScopedRanksForScopesRepo({ scopeType: "collection", scopeIds: collectionIds, entityType: "product" })
  ]);

  const rowsByCollectionId = new Map<number, CollectionItemRow[]>();
  for (const row of rows) {
    const collectionRows = rowsByCollectionId.get(row.collectionId) ?? [];
    collectionRows.push(row);
    rowsByCollectionId.set(row.collectionId, collectionRows);
  }
  for (const collectionId of collectionIds) {
    itemsByCollectionId.set(
      collectionId,
      orderCollectionItems(
        rowsByCollectionId.get(collectionId) ?? [],
        ranksByCollectionId.get(collectionId) ?? new Map()
      )
    );
  }
  return itemsByCollectionId;
}

export async function reorderCollectionsRepo(input: { ids: number[] }) {
  const scopeRows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(isNull(collections.deletedAt));
  assertCompleteOrderedIds({
    requestedIds: input.ids,
    scopeEntityIds: scopeRows.map((row) => row.id),
    errorCode: "INVALID_COLLECTION_ORDER",
    errorMessage: "Collection order is invalid"
  });
  await replaceScopedOrderingRepo({
    scopeType: "root",
    scopeId: null,
    entityType: "collection",
    ids: input.ids
  });
}

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

async function assertRootCollectionCategory(categoryId: number) {
  const [category] = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)))
    .limit(1);

  if (!category || category.parentId != null) {
    const error = new Error("Collection category must be a root category");
    (error as Error & { code?: string }).code = "COLLECTION_CATEGORY_MUST_BE_ROOT";
    throw error;
  }
}

export async function listCollectionsRepo(includeDeleted = false) {
  const rows = await db.select().from(collections).where(includeDeleted ? undefined : isNull(collections.deletedAt));
  const ranked = await withCollectionRanks(await withCollectionMedia(rows), "erp");
  return Promise.all(
    ranked.map(async (row) => {
      const items = await listOrderedCollectionItemsRepo(row.id);
      return { ...row, items };
    })
  );
}

export async function listVisibleCollectionsRepo(lang: Language = "ar") {
  const rows = await db
    .select()
    .from(collections)
    .where(
      sql`${collections.visibility} = 'visible' and ${collections.status} = 'active' and ${collections.deletedAt} is null`
    );
  const ranked = await withCollectionRanks(await withCollectionMedia(rows, lang), "storefront");
  const itemsByCollectionId = await listOrderedItemsByCollectionRepo(ranked.map((row) => row.id));
  return ranked.map((row) => ({ ...row, items: itemsByCollectionId.get(row.id) ?? [] }));
}

export async function findCollectionBySlugRepo(slug: string, lang: Language = "ar") {
  const [row] = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
  if (!row) return null;
  if (row.deletedAt || row.visibility !== "visible" || row.status !== "active") return null;
  const items = await listOrderedCollectionItemsRepo(row.id);
  const [withMedia] = await withCollectionMedia([row], lang);
  return { ...withMedia!, items };
}

export async function findCollectionByIdRepo(id: number) {
  const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  if (!row) return null;
  const items = await listOrderedCollectionItemsRepo(row.id);
  const [withMedia] = await withCollectionMedia([row]);
  return { ...withMedia!, items };
}

export async function upsertCollectionRepo(input: {
  id?: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription?: string | null;
  enDescription?: string | null;
  youtubeUrl?: string | null;
  imagePath?: string | null;
  media?: EntityMediaItem[];
  fixedPrice: number;
  categoryId: number;
  status: "active" | "inactive";
  visibility?: "visible" | "hidden";
  items: Array<{ id?: number; variantId: number; qty: number }>;
}) {
  await assertRootCollectionCategory(input.categoryId);
  const mergedItems = mergeCollectionItems(input.items);
  const shouldReplaceMedia = input.media !== undefined || !input.id;
  const mediaUpdate = shouldReplaceMedia
    ? input.media ?? (input.imagePath
      ? [{ type: "image", arUrl: null, enUrl: input.imagePath }]
      : [])
    : undefined;
  const primaryImagePath = mediaUpdate
    ? resolvePrimaryEntityImagePath(mediaUpdate, input.imagePath ?? null)
    : null;
  return db.transaction(async (tx) => {
  let collectionId = input.id;
  if (collectionId) {
    await tx
      .update(collections)
      .set({
        slug: input.slug,
        arName: input.arName,
        enName: input.enName,
        arDescription: input.arDescription ?? null,
        enDescription: input.enDescription ?? null,
        youtubeUrl: input.youtubeUrl ?? null,
        ...(shouldReplaceMedia ? { imagePath: primaryImagePath } : {}),
        fixedPrice: sql`${input.fixedPrice}`,
        categoryId: input.categoryId,
        status: input.status,
        visibility: input.visibility ?? "visible"
      })
      .where(eq(collections.id, collectionId));
  } else {
    const [created] = await tx
      .insert(collections)
      .values({
        slug: input.slug,
        arName: input.arName,
        enName: input.enName,
        arDescription: input.arDescription ?? null,
        enDescription: input.enDescription ?? null,
        youtubeUrl: input.youtubeUrl ?? null,
        imagePath: primaryImagePath,
        fixedPrice: sql`${input.fixedPrice}`,
        categoryId: input.categoryId,
        status: input.status,
        visibility: input.visibility ?? "visible"
      })
      .$returningId();
    collectionId = created.id;
  }
  if (mediaUpdate !== undefined) {
    await replaceEntityMediaRepo({ type: "collection", id: collectionId! }, mediaUpdate, tx);
  }

  const existingItems = await tx
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
      await tx.delete(collectionItems).where(inArray(collectionItems.id, removedIds));
    }
  }

  for (const item of mergedItems) {
    if (item.id && existingIds.includes(item.id)) {
      await tx
        .update(collectionItems)
        .set({ variantId: item.variantId, qty: item.qty })
        .where(eq(collectionItems.id, item.id));
      continue;
    }

    await tx.insert(collectionItems).values({ collectionId: collectionId!, variantId: item.variantId, qty: item.qty });
  }

  await replaceScopedOrderingRepo(
    {
      scopeType: "collection",
      scopeId: collectionId!,
      entityType: "product",
      ids: await orderedProductIdsForVariants(tx, mergedItems.map((item) => item.variantId))
    },
    tx
  );

  return { id: collectionId! };
  });
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
