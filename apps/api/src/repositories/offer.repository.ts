import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { compareByScopedOrdering, type Language, type OrderingSurface } from "@capella/shared";
import { db } from "@capella/database/src/db";
import { categories, entityMedia, entityOrderings, offerItems, offers, orderItems, productVariants, relatedItems, wishlists } from "@capella/database/drizzle/schema";
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

async function withOfferMedia<T extends { id: number; imagePath: string | null }>(rows: T[], lang: Language = "en") {
  const mediaByOffer = await loadEntityMediaRows("offer", rows.map((row) => row.id));
  return rows.map((row) => {
    const media = normalizeEntityMedia(mediaByOffer.get(row.id), row.imagePath);
    return { ...row, media, imagePath: resolvePrimaryEntityImagePath(media, row.imagePath, lang) };
  });
}

async function withOfferRanks<T extends { id: number }>(rows: T[], surface: OrderingSurface) {
  const rankByOfferId = await loadScopedRanksRepo({
    scopeType: "root",
    scopeId: null,
    entityType: "offer",
    entityIds: rows.map((row) => row.id)
  });
  return rows
    .map((row) => ({ ...row, sortOrder: rankByOfferId.get(row.id) }))
    .sort(compareByScopedOrdering.bind(null, surface));
}

// Items inside one offer must read identically on both surfaces, so the
// erp fallback (older first) is used to keep legacy insertion order for
// items created before in-offer product ordering existed.
type OfferItemRow = {
  id: number;
  offerId: number;
  variantId: number;
  qty: number;
  createdAt: Date;
  productId: number;
};

function selectOfferItemRows() {
  return db
    .select({
      id: offerItems.id,
      offerId: offerItems.offerId,
      variantId: offerItems.variantId,
      qty: offerItems.qty,
      createdAt: offerItems.createdAt,
      productId: productVariants.productId
    })
    .from(offerItems)
    .innerJoin(productVariants, eq(offerItems.variantId, productVariants.id));
}

function orderOfferItems(rows: OfferItemRow[], rankByProductId: Map<number, number>) {
  return rows
    .map((row) => ({ ...row, sortOrder: rankByProductId.get(row.productId) }))
    .sort(compareByScopedOrdering.bind(null, "erp"));
}

async function listOrderedOfferItemsRepo(offerId: number) {
  const rows = await selectOfferItemRows().where(eq(offerItems.offerId, offerId));
  const rankByProductId = await loadScopedRanksRepo({
    scopeType: "offer",
    scopeId: offerId,
    entityType: "product"
  });
  return orderOfferItems(rows, rankByProductId);
}

/**
 * The same ordered items as `listOrderedOfferItemsRepo`, for a whole page of
 * offers in two reads rather than two per offer.
 */
async function listOrderedItemsByOfferRepo(offerIds: number[]) {
  const itemsByOfferId = new Map<number, ReturnType<typeof orderOfferItems>>();
  if (offerIds.length === 0) {
    return itemsByOfferId;
  }

  const [rows, ranksByOfferId] = await Promise.all([
    selectOfferItemRows().where(inArray(offerItems.offerId, offerIds)),
    loadScopedRanksForScopesRepo({ scopeType: "offer", scopeIds: offerIds, entityType: "product" })
  ]);

  const rowsByOfferId = new Map<number, OfferItemRow[]>();
  for (const row of rows) {
    const offerRows = rowsByOfferId.get(row.offerId) ?? [];
    offerRows.push(row);
    rowsByOfferId.set(row.offerId, offerRows);
  }
  for (const offerId of offerIds) {
    itemsByOfferId.set(
      offerId,
      orderOfferItems(rowsByOfferId.get(offerId) ?? [], ranksByOfferId.get(offerId) ?? new Map())
    );
  }
  return itemsByOfferId;
}

export async function reorderOffersRepo(input: { ids: number[] }) {
  const scopeRows = await db
    .select({ id: offers.id })
    .from(offers)
    .where(isNull(offers.deletedAt));
  assertCompleteOrderedIds({
    requestedIds: input.ids,
    scopeEntityIds: scopeRows.map((row) => row.id),
    errorCode: "INVALID_OFFER_ORDER",
    errorMessage: "Offer order is invalid"
  });
  await replaceScopedOrderingRepo({
    scopeType: "root",
    scopeId: null,
    entityType: "offer",
    ids: input.ids
  });
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Runs inside the offer write transaction and locks the category row, so a
// concurrent soft-delete or reparent cannot commit between the check and the
// insert and leave the offer classified under a non-root category.
async function assertRootOfferCategory(tx: DbTransaction, categoryId: number) {
  const [category] = await tx
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)))
    .limit(1)
    .for("update");

  if (!category || category.parentId != null) {
    const error = new Error("Offer category must be a root category");
    (error as Error & { code?: string }).code = "OFFER_CATEGORY_MUST_BE_ROOT";
    throw error;
  }
}

function mergeOfferItems(items: Array<{ id?: number; variantId: number; qty: number }>) {
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

export async function listOffersRepo(includeDeleted = false) {
  const rows = await db.select().from(offers).where(includeDeleted ? undefined : isNull(offers.deletedAt));
  const ranked = await withOfferRanks(await withOfferMedia(rows), "erp");
  return Promise.all(
    ranked.map(async (row) => {
      const items = await listOrderedOfferItemsRepo(row.id);
      return { ...row, items };
    })
  );
}

export async function listVisibleOffersRepo(lang: Language = "ar") {
  const rows = await db
    .select()
    .from(offers)
    .where(sql`${offers.visibility} = 'visible' and ${offers.status} = 'active' and ${offers.deletedAt} is null`);
  const ranked = await withOfferRanks(await withOfferMedia(rows, lang), "storefront");
  const itemsByOfferId = await listOrderedItemsByOfferRepo(ranked.map((row) => row.id));
  return ranked.map((row) => ({ ...row, items: itemsByOfferId.get(row.id) ?? [] }));
}

export async function findOfferBySlugRepo(slug: string, lang: Language = "ar") {
  const [row] = await db.select().from(offers).where(eq(offers.slug, slug)).limit(1);
  if (!row) return null;
  if (row.deletedAt || row.visibility !== "visible" || row.status !== "active") return null;
  const items = await listOrderedOfferItemsRepo(row.id);
  const [withMedia] = await withOfferMedia([row], lang);
  return { ...withMedia!, items };
}

export async function findOfferByIdRepo(id: number) {
  const [row] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!row) return null;
  const items = await listOrderedOfferItemsRepo(row.id);
  const [withMedia] = await withOfferMedia([row]);
  return { ...withMedia!, items };
}

export async function upsertOfferRepo(input: {
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
  const mergedItems = mergeOfferItems(input.items);
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
  await assertRootOfferCategory(tx, input.categoryId);
  let offerId = input.id;
  if (offerId) {
    await tx
      .update(offers)
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
        // Omitting visibility on an edit leaves it alone; defaulting here would
        // silently republish an offer the admin had deliberately hidden.
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {})
      })
      .where(eq(offers.id, offerId));
  } else {
    const [created] = await tx
      .insert(offers)
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
    offerId = created.id;
  }
  if (mediaUpdate !== undefined) {
    await replaceEntityMediaRepo({ type: "offer", id: offerId! }, mediaUpdate, tx);
  }
  const existingItems = await tx
    .select({ id: offerItems.id })
    .from(offerItems)
    .where(eq(offerItems.offerId, offerId!));
  const existingIds = existingItems.map((item) => item.id);
  const keptIds = mergedItems
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number" && existingIds.includes(id));

  if (existingIds.length > 0) {
    const removedIds = existingIds.filter((id) => !keptIds.includes(id));
    if (removedIds.length > 0) {
      await tx.delete(offerItems).where(inArray(offerItems.id, removedIds));
    }
  }

  for (const item of mergedItems) {
    if (item.id && existingIds.includes(item.id)) {
      await tx
        .update(offerItems)
        .set({ variantId: item.variantId, qty: item.qty })
        .where(eq(offerItems.id, item.id));
      continue;
    }

    await tx.insert(offerItems).values({ offerId: offerId!, variantId: item.variantId, qty: item.qty });
  }
  await replaceScopedOrderingRepo(
    {
      scopeType: "offer",
      scopeId: offerId!,
      entityType: "product",
      ids: await orderedProductIdsForVariants(tx, mergedItems.map((item) => item.variantId))
    },
    tx
  );
  return { id: offerId! };
  });
}

export async function softDeleteOfferRepo(id: number) {
  await db.update(offers).set({ deletedAt: sql`NOW()` }).where(eq(offers.id, id));
}

export async function restoreOfferRepo(id: number) {
  // An offer with no category predates classification. Restoring it must never
  // put it back on the storefront, so it always comes back parked as inactive.
  const [existing] = await db
    .select({ categoryId: offers.categoryId })
    .from(offers)
    .where(eq(offers.id, id))
    .limit(1);

  await db
    .update(offers)
    .set(existing && existing.categoryId == null ? { deletedAt: null, status: "inactive" } : { deletedAt: null })
    .where(eq(offers.id, id));
}

export async function hardDeleteOfferRepo(id: number): Promise<{ mediaUrls: string[] } | null> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ deletedAt: offers.deletedAt, imagePath: offers.imagePath })
      .from(offers)
      .where(eq(offers.id, id))
      .limit(1);

    if (!existing || existing.deletedAt == null) {
      return null;
    }

    const sold = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.offerId, id))
      .limit(1);
    if (sold.length > 0) {
      const error = new Error("linked-to-orders") as Error & { code?: string };
      error.code = "OFFER_LINKED_TO_ORDERS";
      throw error;
    }

    const mediaRows = await tx
      .select({ url: entityMedia.url, arUrl: entityMedia.arUrl })
      .from(entityMedia)
      .where(eq(entityMedia.offerId, id));

    await tx.delete(wishlists).where(and(eq(wishlists.entityType, "offer"), eq(wishlists.entityId, id)));
    await tx
      .delete(relatedItems)
      .where(
        or(
          and(eq(relatedItems.sourceType, "offer"), eq(relatedItems.sourceId, id)),
          and(eq(relatedItems.targetType, "offer"), eq(relatedItems.targetId, id))
        )
      );
    await tx.delete(offerItems).where(eq(offerItems.offerId, id));
    await tx
      .delete(entityOrderings)
      .where(
        or(
          and(eq(entityOrderings.entityType, "offer"), eq(entityOrderings.entityId, id)),
          and(eq(entityOrderings.scopeType, "offer"), eq(entityOrderings.scopeId, id))
        )
      );
    await tx.delete(offers).where(eq(offers.id, id));
    return {
      mediaUrls: [existing.imagePath, ...mediaRows.flatMap((item) => [item.url, item.arUrl])]
        .filter((url): url is string => Boolean(url))
    };
  });
}

export async function toggleOfferStatusRepo(id: number) {
  const [current] = await db
    .select({ status: offers.status, categoryId: offers.categoryId })
    .from(offers)
    .where(eq(offers.id, id))
    .limit(1);
  if (!current) return;

  const nextStatus = current.status === "active" ? "inactive" : "active";
  // This path bypasses the upsert validation, so it is the last place that can
  // stop an uncategorised legacy offer from being switched on to the storefront.
  if (nextStatus === "active" && current.categoryId == null) {
    const error = new Error("Offer must have a category before it can be activated");
    (error as Error & { code?: string }).code = "OFFER_CATEGORY_REQUIRED";
    throw error;
  }

  await db.update(offers).set({ status: nextStatus }).where(eq(offers.id, id));
}
