import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { collections, offers, products, wishlists } from "@capella/database/drizzle/schema";
import type { WishlistEntryDto, WishlistItemDto } from "@capella/shared";
import {
  loadEntityMediaRows,
  normalizeEntityMedia,
  resolvePrimaryEntityImagePath
} from "./entity-media.repository.js";

type WishlistEntityType = WishlistItemDto["entityType"];

export class WishlistEntityValidationError extends Error {
  constructor(
    public readonly statusCode: 400 | 404,
    message: string
  ) {
    super(message);
  }
}

async function wishlistTargetExists(entityType: WishlistEntityType, entityId: number) {
  const table = entityType === "product" ? products : entityType === "offer" ? offers : collections;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);
  return rows.length > 0;
}

export function listWishlistByCustomer(customerId: number) {
  return db
    .select()
    .from(wishlists)
    .where(eq(wishlists.customerId, customerId))
    .orderBy(asc(wishlists.id));
}

export async function addWishlistItem(customerId: number, entityType: WishlistEntityType, entityId: number) {
  if (!Number.isInteger(entityId) || entityId <= 0) {
    throw new WishlistEntityValidationError(400, "entityType and entityId required");
  }
  if (!(await wishlistTargetExists(entityType, entityId))) {
    throw new WishlistEntityValidationError(404, "Wishlist target not found");
  }

  const exists = await db
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(
      and(
        eq(wishlists.customerId, customerId),
        eq(wishlists.entityType, entityType),
        eq(wishlists.entityId, entityId)
      )
    )
    .limit(1);
  if (exists.length === 0) {
    await db.insert(wishlists).values({ customerId, entityType, entityId });
  }
}

export function removeWishlistItem(customerId: number, entityType: WishlistEntityType, entityId: number) {
  return db
    .delete(wishlists)
    .where(
      and(
        eq(wishlists.customerId, customerId),
        eq(wishlists.entityType, entityType),
        eq(wishlists.entityId, entityId)
      )
    );
}

export async function listWishlistEntriesByCustomer(customerId: number): Promise<WishlistEntryDto[]> {
  const rows = await listWishlistByCustomer(customerId);
  if (rows.length === 0) return [];

  const productIds = rows.filter((row) => row.entityType === "product").map((row) => row.entityId);
  const offerIds = rows.filter((row) => row.entityType === "offer").map((row) => row.entityId);
  const collectionIds = rows.filter((row) => row.entityType === "collection").map((row) => row.entityId);

  const [productRows, offerRows, collectionRows] = await Promise.all([
    productIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: products.id,
            arName: products.arName,
            enName: products.enName,
            slug: products.slug,
            imagePath: products.imagePath,
            status: products.status,
            deletedAt: products.deletedAt
          })
          .from(products)
          .where(inArray(products.id, productIds)),
    offerIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: offers.id,
            arName: offers.arName,
            enName: offers.enName,
            slug: offers.slug,
            imagePath: offers.imagePath,
            status: offers.status,
            visibility: offers.visibility,
            deletedAt: offers.deletedAt
          })
          .from(offers)
          .where(inArray(offers.id, offerIds)),
    collectionIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: collections.id,
            arName: collections.arName,
            enName: collections.enName,
            slug: collections.slug,
            imagePath: collections.imagePath,
            status: collections.status,
            visibility: collections.visibility,
            deletedAt: collections.deletedAt
          })
          .from(collections)
          .where(inArray(collections.id, collectionIds))
  ]);

  // The legacy `imagePath` column is often empty (media now lives in
  // `entity_media`), and even when set it holds a storage-relative
  // `/uploads/...` path that only resolves against the public uploads base.
  // Mirror the product/offer/collection repos so wishlist rows get a usable URL.
  const [productMedia, offerMedia, collectionMedia] = await Promise.all([
    loadEntityMediaRows("product", productIds),
    loadEntityMediaRows("offer", offerIds),
    loadEntityMediaRows("collection", collectionIds)
  ]);

  const imageFor = (
    type: "product" | "offer" | "collection",
    id: number,
    imagePath: string | null
  ) => {
    const rows = (type === "product" ? productMedia : type === "offer" ? offerMedia : collectionMedia).get(id);
    return resolvePrimaryEntityImagePath(normalizeEntityMedia(rows, imagePath), imagePath);
  };

  const productById = new Map(
    productRows.map((row) => [
      row.id,
      {
        entityType: "product" as const,
        entityId: row.id,
        name: { ar: row.arName, en: row.enName },
        imagePath: imageFor("product", row.id, row.imagePath),
        href: `/products/${row.slug}`,
        availability: row.status === "active" && !row.deletedAt ? "available" as const : "unavailable" as const
      }
    ])
  );
  const offerById = new Map(
    offerRows.map((row) => [
      row.id,
      {
        entityType: "offer" as const,
        entityId: row.id,
        name: { ar: row.arName, en: row.enName },
        imagePath: imageFor("offer", row.id, row.imagePath),
        href: row.status === "active" && row.visibility === "visible" && !row.deletedAt ? `/offers/${row.slug}` : null,
        availability:
          row.status === "active" && row.visibility === "visible" && !row.deletedAt ? "available" as const : "unavailable" as const
      }
    ])
  );
  const collectionById = new Map(
    collectionRows.map((row) => [
      row.id,
      {
        entityType: "collection" as const,
        entityId: row.id,
        name: { ar: row.arName, en: row.enName },
        imagePath: imageFor("collection", row.id, row.imagePath),
        href:
          row.status === "active" && row.visibility === "visible" && !row.deletedAt
            ? `/collections/${row.slug}`
            : null,
        availability:
          row.status === "active" && row.visibility === "visible" && !row.deletedAt ? "available" as const : "unavailable" as const
      }
    ])
  );

  const entries: WishlistEntryDto[] = [];

  for (const row of rows) {
    const entry =
      row.entityType === "product"
        ? productById.get(row.entityId)
        : row.entityType === "offer"
          ? offerById.get(row.entityId)
          : collectionById.get(row.entityId);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}
