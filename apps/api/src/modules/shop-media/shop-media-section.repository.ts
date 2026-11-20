import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  categories,
  collections,
  offers,
  products,
  shopCustomBlocks,
  shopMediaSectionItems,
  shopMediaSections,
  type shopMediaSectionTargetTypes
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

type ShopMediaTargetType = (typeof shopMediaSectionTargetTypes)[number];

export type ShopMediaSectionItemInput = {
  arImagePath: string | null;
  arMobileImagePath: string | null;
  enImagePath: string | null;
  enMobileImagePath: string | null;
  targetType: ShopMediaTargetType;
  targetId: number | null;
  sortOrder: number;
};

export type ShopCustomBlockInput =
  | { type: "category"; categoryId: number }
  | { type: "media"; mediaSectionId: number | null; status: "active" | "inactive"; items: ShopMediaSectionItemInput[] };

type DbExecutor = Pick<typeof db, "select" | "insert">;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SectionRow = typeof shopMediaSections.$inferSelect;

/** The top banner is the only picture section with a fixed place (slot 1); it always exists so the ERP can fill it. */
const TOP_BANNER_SLOT = 1;

async function ensureShopMediaSections(tx: DbExecutor = db) {
  const existing = await tx
    .select({ id: shopMediaSections.id })
    .from(shopMediaSections)
    .where(eq(shopMediaSections.slot, TOP_BANNER_SLOT))
    .limit(1);
  if (existing.length === 0) {
    await tx.insert(shopMediaSections).values({ slot: TOP_BANNER_SLOT, status: "inactive" });
  }
}

async function loadTargetSlugMap(items: Array<{ targetType: ShopMediaTargetType; targetId: number | null }>) {
  const productIds = items.filter((item) => item.targetType === "product" && item.targetId != null).map((item) => item.targetId!);
  const offerIds = items.filter((item) => item.targetType === "offer" && item.targetId != null).map((item) => item.targetId!);
  const collectionIds = items.filter((item) => item.targetType === "collection" && item.targetId != null).map((item) => item.targetId!);
  const categoryIds = items.filter((item) => item.targetType === "category" && item.targetId != null).map((item) => item.targetId!);

  // Soft-deleted targets must not resolve to a slug: the storefront treats a missing slug as "link to home" instead of sending shoppers to a page that no longer exists.
  const [productRows, offerRows, collectionRows, categoryRows] = await Promise.all([
    productIds.length > 0
      ? db.select({ id: products.id, slug: products.slug }).from(products).where(and(inArray(products.id, productIds), isNull(products.deletedAt)))
      : Promise.resolve([]),
    offerIds.length > 0
      ? db.select({ id: offers.id, slug: offers.slug }).from(offers).where(and(inArray(offers.id, offerIds), isNull(offers.deletedAt)))
      : Promise.resolve([]),
    collectionIds.length > 0
      ? db.select({ id: collections.id, slug: collections.slug }).from(collections).where(and(inArray(collections.id, collectionIds), isNull(collections.deletedAt)))
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.select({ id: categories.id, slug: categories.slug }).from(categories).where(and(inArray(categories.id, categoryIds), isNull(categories.deletedAt)))
      : Promise.resolve([])
  ]);

  return {
    product: new Map(productRows.map((row) => [row.id, row.slug])),
    offer: new Map(offerRows.map((row) => [row.id, row.slug])),
    collection: new Map(collectionRows.map((row) => [row.id, row.slug])),
    category: new Map(categoryRows.map((row) => [row.id, row.slug]))
  };
}

async function listSectionsBase() {
  await ensureShopMediaSections();
  const sectionRows = await db
    .select()
    .from(shopMediaSections)
    .where(isNotNull(shopMediaSections.slot))
    .orderBy(asc(shopMediaSections.slot));
  return mapSections(sectionRows);
}

async function mapSections(sectionRows: SectionRow[]) {
  if (sectionRows.length === 0) {
    return [];
  }
  const itemRows = await db
    .select()
    .from(shopMediaSectionItems)
    .where(inArray(shopMediaSectionItems.sectionId, sectionRows.map((section) => section.id)))
    .orderBy(asc(shopMediaSectionItems.sectionId), asc(shopMediaSectionItems.sortOrder), asc(shopMediaSectionItems.id));
  const slugMap = await loadTargetSlugMap(itemRows);

  return sectionRows.map((section) => ({
    id: section.id,
    slot: section.slot === TOP_BANNER_SLOT ? (TOP_BANNER_SLOT as 1) : null,
    status: section.status,
    items: itemRows
      .filter((item) => item.sectionId === section.id)
      .map((item) => ({
        id: item.id,
        arImagePath: item.arImagePath,
        arMobileImagePath: item.arMobileImagePath,
        enImagePath: item.enImagePath,
        enMobileImagePath: item.enMobileImagePath,
        targetType: item.targetType,
        targetId: item.targetId,
        targetSlug:
          item.targetType === "product" ? (item.targetId == null ? null : slugMap.product.get(item.targetId) ?? null)
            : item.targetType === "offer" ? (item.targetId == null ? null : slugMap.offer.get(item.targetId) ?? null)
              : item.targetType === "collection" ? (item.targetId == null ? null : slugMap.collection.get(item.targetId) ?? null)
                : item.targetType === "category" ? (item.targetId == null ? null : slugMap.category.get(item.targetId) ?? null)
                  : null,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt ?? ""),
        updatedAt: item.updatedAt?.toISOString?.() ?? String(item.updatedAt ?? "")
      })),
    createdAt: section.createdAt?.toISOString?.() ?? String(section.createdAt ?? ""),
    updatedAt: section.updatedAt?.toISOString?.() ?? String(section.updatedAt ?? "")
  }));
}

export async function listShopMediaSectionsRepo() {
  return listSectionsBase();
}

export async function listActiveShopMediaSectionsRepo() {
  const sections = await listSectionsBase();
  return sections.filter((section) => section.status === "active" && section.items.length > 0);
}

async function writeSectionItems(tx: Tx, sectionId: number, items: ShopMediaSectionItemInput[]) {
  await tx.delete(shopMediaSectionItems).where(eq(shopMediaSectionItems.sectionId, sectionId));
  if (items.length > 0) {
    await tx.insert(shopMediaSectionItems).values(items.map((item) => ({ sectionId, ...item })));
  }
}

/** Every custom section in order, inactive picture sections included (the ERP view). */
export async function listShopCustomBlocksRepo() {
  const blockRows = await db.select().from(shopCustomBlocks).orderBy(asc(shopCustomBlocks.sortOrder), asc(shopCustomBlocks.id));
  const mediaSectionIds = blockRows.flatMap((block) => (block.mediaSectionId == null ? [] : [block.mediaSectionId]));
  const sectionRows = mediaSectionIds.length > 0
    ? await db.select().from(shopMediaSections).where(inArray(shopMediaSections.id, mediaSectionIds))
    : [];
  const sectionsById = new Map((await mapSections(sectionRows)).map((section) => [section.id, section] as const));

  type MappedSection = Awaited<ReturnType<typeof mapSections>>[number];
  type Block =
    | { id: number; type: "category"; categoryId: number; mediaSection: null; sortOrder: number }
    | { id: number; type: "media"; categoryId: null; mediaSection: MappedSection; sortOrder: number };

  return blockRows.flatMap((block): Block[] => {
    if (block.type === "category" && block.categoryId != null) {
      return [{ id: block.id, type: "category" as const, categoryId: block.categoryId, mediaSection: null, sortOrder: block.sortOrder }];
    }
    const mediaSection = block.mediaSectionId == null ? undefined : sectionsById.get(block.mediaSectionId);
    return mediaSection
      ? [{ id: block.id, type: "media" as const, categoryId: null, mediaSection, sortOrder: block.sortOrder }]
      : [];
  });
}

/** What the shop page shows: categories not in the trash, and picture sections that are on and have pictures. Whether a category row has products is decided by the storefront. */
export async function listActiveShopCustomBlocksRepo() {
  const blocks = await listShopCustomBlocksRepo();
  const categoryIds = blocks.flatMap((block) => (block.type === "category" ? [block.categoryId] : []));
  const liveCategoryIds = new Set(
    categoryIds.length > 0
      ? (await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(inArray(categories.id, categoryIds), isNull(categories.deletedAt)))).map((row) => row.id)
      : []
  );

  return blocks.filter((block) => (
    block.type === "category"
      ? liveCategoryIds.has(block.categoryId)
      : block.mediaSection.status === "active" && block.mediaSection.items.length > 0
  ));
}

/** Ids of the picture sections that belong to the custom sections (never the top banner). */
export async function listCustomMediaSectionIdsRepo() {
  const rows = await db.select({ id: shopMediaSections.id }).from(shopMediaSections).where(isNull(shopMediaSections.slot));
  return new Set(rows.map((row) => row.id));
}

/** True when every id is a category that exists and is not in the trash. */
export async function liveCategoriesExistRepo(ids: number[]) {
  if (ids.length === 0) {
    return true;
  }
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(inArray(categories.id, ids), isNull(categories.deletedAt)));
  return rows.length === new Set(ids).size;
}

/** Replaces the whole custom sections list in one go: new picture sections are created, kept ones updated, and picture sections left out are deleted with their pictures. */
export async function replaceShopCustomBlocksRepo(blocks: ShopCustomBlockInput[]) {
  await db.transaction(async (tx) => {
    const existingMedia = await tx.select({ id: shopMediaSections.id }).from(shopMediaSections).where(isNull(shopMediaSections.slot));
    const keptMediaIds = new Set<number>();
    const blockRows: Array<typeof shopCustomBlocks.$inferInsert> = [];

    for (const [index, block] of blocks.entries()) {
      const sortOrder = index + 1;
      if (block.type === "category") {
        blockRows.push({ type: "category", categoryId: block.categoryId, mediaSectionId: null, sortOrder });
        continue;
      }

      let sectionId = block.mediaSectionId;
      if (sectionId == null) {
        const [created] = await tx.insert(shopMediaSections).values({ slot: null, status: block.status }).$returningId();
        sectionId = created.id;
      } else {
        await tx.update(shopMediaSections).set({ status: block.status }).where(eq(shopMediaSections.id, sectionId));
      }
      keptMediaIds.add(sectionId);
      await writeSectionItems(tx, sectionId, block.items);
      blockRows.push({ type: "media", categoryId: null, mediaSectionId: sectionId, sortOrder });
    }

    await tx.delete(shopCustomBlocks);
    const droppedMediaIds = existingMedia.map((row) => row.id).filter((id) => !keptMediaIds.has(id));
    if (droppedMediaIds.length > 0) {
      await tx.delete(shopMediaSections).where(inArray(shopMediaSections.id, droppedMediaIds));
    }
    if (blockRows.length > 0) {
      await tx.insert(shopCustomBlocks).values(blockRows);
    }
  });
}

export async function replaceShopMediaSectionRepo(slot: 1, status: "active" | "inactive", items: ShopMediaSectionItemInput[]) {
  await db.transaction(async (tx) => {
    await ensureShopMediaSections(tx);
    const [section] = await tx
      .select({ id: shopMediaSections.id })
      .from(shopMediaSections)
      .where(eq(shopMediaSections.slot, slot))
      .limit(1);

    if (!section) {
      throw new Error(`Missing shop media section slot ${slot}`);
    }

    await tx
      .update(shopMediaSections)
      .set({ status })
      .where(eq(shopMediaSections.id, section.id));

    await writeSectionItems(tx, section.id, items);
  });
}

// A trashed entity is not a valid banner target, so saving one is rejected the same way a non-existent id is.
export async function shopMediaTargetExists(targetType: ShopMediaTargetType, targetId: number) {
  if (targetType === "product") {
    const [row] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, targetId), isNull(products.deletedAt))).limit(1);
    return Boolean(row);
  }
  if (targetType === "offer") {
    const [row] = await db.select({ id: offers.id }).from(offers).where(and(eq(offers.id, targetId), isNull(offers.deletedAt))).limit(1);
    return Boolean(row);
  }
  if (targetType === "collection") {
    const [row] = await db.select({ id: collections.id }).from(collections).where(and(eq(collections.id, targetId), isNull(collections.deletedAt))).limit(1);
    return Boolean(row);
  }
  if (targetType === "category") {
    const [row] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, targetId), isNull(categories.deletedAt))).limit(1);
    return Boolean(row);
  }
  // Listing target types (shop, new, bestsellers, products, offers, collections) don't have target IDs
  throw new Error(`shopMediaTargetExists does not support target type: ${targetType}`);
}
