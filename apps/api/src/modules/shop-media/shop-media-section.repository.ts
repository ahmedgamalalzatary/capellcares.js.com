import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { SHOP_PAGE_DEFAULT_BLOCK_TYPES, type ShopPageBlock } from "@capella/shared";
import {
  categories,
  collections,
  offers,
  products,
  shopMediaSectionItems,
  shopMediaSections,
  shopPageBlocks,
  shopPageBuiltInBlockTypes,
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

export type ShopPageBlockInput =
  | { type: (typeof shopPageBuiltInBlockTypes)[number] }
  | { type: "category"; categoryId: number }
  | { type: "media"; mediaSectionId: number | null; status: "active" | "inactive"; items: ShopMediaSectionItemInput[] };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SectionRow = typeof shopMediaSections.$inferSelect;
type BuiltInBlockType = (typeof shopPageBuiltInBlockTypes)[number];

/** What a shop that never set its layout shows. */
const DEFAULT_LAYOUT: readonly BuiltInBlockType[] = SHOP_PAGE_DEFAULT_BLOCK_TYPES;

/** A shop that never set its layout (a new database) starts from the built-in sections. Saving always keeps at least one section, so an empty table only ever means "never set". */
async function ensureShopPageLayout() {
  const [existing] = await db.select({ id: shopPageBlocks.id }).from(shopPageBlocks).limit(1);
  if (!existing) {
    // Ignored when another request filled it first: block_key keeps each built-in section to one row.
    await db.insert(shopPageBlocks).ignore().values(DEFAULT_LAYOUT.map((type, index) => ({ type, blockKey: type, sortOrder: index + 1 })));
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

async function writeSectionItems(tx: Tx, sectionId: number, items: ShopMediaSectionItemInput[]) {
  await tx.delete(shopMediaSectionItems).where(eq(shopMediaSectionItems.sectionId, sectionId));
  if (items.length > 0) {
    await tx.insert(shopMediaSectionItems).values(items.map((item) => ({ sectionId, ...item })));
  }
}

/** Every section of the shop page in order, inactive picture sections and trashed categories included (the ERP view). */
export async function listShopPageBlocksRepo(): Promise<ShopPageBlock[]> {
  await ensureShopPageLayout();
  const blockRows = await db.select().from(shopPageBlocks).orderBy(asc(shopPageBlocks.sortOrder), asc(shopPageBlocks.id));
  const mediaSectionIds = blockRows.flatMap((block) => (block.mediaSectionId == null ? [] : [block.mediaSectionId]));
  const sectionRows = mediaSectionIds.length > 0
    ? await db.select().from(shopMediaSections).where(inArray(shopMediaSections.id, mediaSectionIds))
    : [];
  const sectionsById = new Map((await mapSections(sectionRows)).map((section) => [section.id, section] as const));

  return blockRows.flatMap((block): ShopPageBlock[] => {
    if (block.type === "category") {
      return block.categoryId == null ? [] : [{ id: block.id, type: "category", categoryId: block.categoryId, mediaSection: null, sortOrder: block.sortOrder }];
    }
    if (block.type === "media") {
      const mediaSection = block.mediaSectionId == null ? undefined : sectionsById.get(block.mediaSectionId);
      return mediaSection ? [{ id: block.id, type: "media", categoryId: null, mediaSection, sortOrder: block.sortOrder }] : [];
    }
    return [{ id: block.id, type: block.type, categoryId: null, mediaSection: null, sortOrder: block.sortOrder }];
  });
}

/** What the shop page shows: categories not in the trash, and picture sections that are on and have pictures. Whether a section has products to show is decided by the storefront. */
export async function listActiveShopPageBlocksRepo() {
  const blocks = await listShopPageBlocksRepo();
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
    block.type === "category" ? liveCategoryIds.has(block.categoryId)
      : block.type === "media" ? block.mediaSection.status === "active" && block.mediaSection.items.length > 0
        : true
  ));
}

/** The shop page's live picture sections, in page order. */
export async function listActiveShopMediaSectionsRepo() {
  return (await listActiveShopPageBlocksRepo()).flatMap((block) => (block.type === "media" ? [block.mediaSection] : []));
}

/** Ids of every picture section (each belongs to one place on the shop page). */
export async function listShopMediaSectionIdsRepo() {
  const rows = await db.select({ id: shopMediaSections.id }).from(shopMediaSections);
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

/** Replaces the whole shop page in one go: new picture sections are created, kept ones updated, and picture sections left out are deleted with their pictures. */
export async function replaceShopPageBlocksRepo(blocks: ShopPageBlockInput[]) {
  await db.transaction(async (tx) => {
    const existingMedia = await tx.select({ id: shopMediaSections.id }).from(shopMediaSections);
    const keptMediaIds = new Set<number>();
    const blockRows: Array<typeof shopPageBlocks.$inferInsert> = [];

    for (const [index, block] of blocks.entries()) {
      const sortOrder = index + 1;
      if (block.type === "category") {
        blockRows.push({ type: "category", blockKey: `category:${block.categoryId}`, categoryId: block.categoryId, sortOrder });
        continue;
      }
      if (block.type !== "media") {
        blockRows.push({ type: block.type, blockKey: block.type, sortOrder });
        continue;
      }

      let sectionId = block.mediaSectionId;
      if (sectionId == null) {
        const [created] = await tx.insert(shopMediaSections).values({ status: block.status }).$returningId();
        sectionId = created!.id;
      } else {
        await tx.update(shopMediaSections).set({ status: block.status }).where(eq(shopMediaSections.id, sectionId));
      }
      keptMediaIds.add(sectionId);
      await writeSectionItems(tx, sectionId, block.items);
      blockRows.push({ type: "media", blockKey: `media:${sectionId}`, mediaSectionId: sectionId, sortOrder });
    }

    await tx.delete(shopPageBlocks);
    const droppedMediaIds = existingMedia.map((row) => row.id).filter((id) => !keptMediaIds.has(id));
    if (droppedMediaIds.length > 0) {
      await tx.delete(shopMediaSections).where(inArray(shopMediaSections.id, droppedMediaIds));
    }
    if (blockRows.length > 0) {
      await tx.insert(shopPageBlocks).values(blockRows);
    }
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
