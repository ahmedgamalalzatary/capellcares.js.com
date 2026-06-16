import { asc, eq, inArray } from "drizzle-orm";
import {
  categories,
  collections,
  offers,
  products,
  shopMediaSectionItems,
  shopMediaSections,
  type shopMediaSectionTargetTypes
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

type ShopMediaTargetType = (typeof shopMediaSectionTargetTypes)[number];

type ShopMediaSectionItemInput = {
  imagePath: string;
  targetType: ShopMediaTargetType;
  targetId: number | null;
  sortOrder: number;
};

type DbExecutor = Pick<typeof db, "select" | "insert">;

async function ensureShopMediaSections(tx: DbExecutor = db) {
  const existing = await tx
    .select({ slot: shopMediaSections.slot })
    .from(shopMediaSections)
    .where(inArray(shopMediaSections.slot, [1, 2, 3]));
  const existingSlots = new Set(existing.map((row) => row.slot));
  const missingSlots = [1, 2, 3].filter((slot) => !existingSlots.has(slot));
  if (missingSlots.length > 0) {
    await tx.insert(shopMediaSections).values(
      missingSlots.map((slot) => ({ slot, status: "inactive" as const }))
    );
  }
}

async function loadTargetSlugMap(items: Array<{ targetType: ShopMediaTargetType; targetId: number | null }>) {
  const productIds = items.filter((item) => item.targetType === "product" && item.targetId != null).map((item) => item.targetId!);
  const offerIds = items.filter((item) => item.targetType === "offer" && item.targetId != null).map((item) => item.targetId!);
  const collectionIds = items.filter((item) => item.targetType === "collection" && item.targetId != null).map((item) => item.targetId!);
  const categoryIds = items.filter((item) => item.targetType === "category" && item.targetId != null).map((item) => item.targetId!);

  const [productRows, offerRows, collectionRows, categoryRows] = await Promise.all([
    productIds.length > 0
      ? db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.id, productIds))
      : Promise.resolve([]),
    offerIds.length > 0
      ? db.select({ id: offers.id, slug: offers.slug }).from(offers).where(inArray(offers.id, offerIds))
      : Promise.resolve([]),
    collectionIds.length > 0
      ? db.select({ id: collections.id, slug: collections.slug }).from(collections).where(inArray(collections.id, collectionIds))
      : Promise.resolve([]),
    categoryIds.length > 0
      ? db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.id, categoryIds))
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
  const sectionRows = await db.select().from(shopMediaSections).orderBy(asc(shopMediaSections.slot));
  const itemRows = await db
    .select()
    .from(shopMediaSectionItems)
    .orderBy(asc(shopMediaSectionItems.sectionId), asc(shopMediaSectionItems.sortOrder), asc(shopMediaSectionItems.id));
  const slugMap = await loadTargetSlugMap(itemRows);

  return sectionRows.map((section) => ({
    id: section.id,
    slot: section.slot as 1 | 2 | 3,
    status: section.status,
    items: itemRows
      .filter((item) => item.sectionId === section.id)
      .map((item) => ({
        id: item.id,
        imagePath: item.imagePath,
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

export async function replaceShopMediaSectionRepo(slot: 1 | 2 | 3, status: "active" | "inactive", items: ShopMediaSectionItemInput[]) {
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

    await tx.delete(shopMediaSectionItems).where(eq(shopMediaSectionItems.sectionId, section.id));

    if (items.length > 0) {
      await tx.insert(shopMediaSectionItems).values(
        items.map((item) => ({
          sectionId: section.id,
          imagePath: item.imagePath,
          targetType: item.targetType,
          targetId: item.targetId,
          sortOrder: item.sortOrder
        }))
      );
    }
  });
}

export async function shopMediaTargetExists(targetType: ShopMediaTargetType, targetId: number) {
  if (targetType === "product") {
    const [row] = await db.select({ id: products.id }).from(products).where(eq(products.id, targetId)).limit(1);
    return Boolean(row);
  }
  if (targetType === "offer") {
    const [row] = await db.select({ id: offers.id }).from(offers).where(eq(offers.id, targetId)).limit(1);
    return Boolean(row);
  }
  if (targetType === "collection") {
    const [row] = await db.select({ id: collections.id }).from(collections).where(eq(collections.id, targetId)).limit(1);
    return Boolean(row);
  }
  if (targetType === "category") {
    const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, targetId)).limit(1);
    return Boolean(row);
  }
  // Listing target types (shop, new, bestsellers, products, offers, collections) don't have target IDs
  throw new Error(`shopMediaTargetExists does not support target type: ${targetType}`);
}
