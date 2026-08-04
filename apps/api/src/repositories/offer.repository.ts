import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { compareByScopedOrdering, type OrderingSurface } from "@capella/shared";
import { db } from "@capella/database/src/db";
import { entityOrderings, offerItems, offers, productVariants, relatedItems } from "@capella/database/drizzle/schema";
import {
  assertCompleteOrderedIds,
  loadScopedRanksForScopesRepo,
  loadScopedRanksRepo,
  orderedProductIdsForVariants,
  replaceScopedOrderingRepo
} from "./entity-ordering.repository.js";

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
  const ranked = await withOfferRanks(rows, "erp");
  return Promise.all(
    ranked.map(async (row) => {
      const items = await listOrderedOfferItemsRepo(row.id);
      return { ...row, items };
    })
  );
}

export async function listVisibleOffersRepo() {
  const rows = await db
    .select()
    .from(offers)
    .where(sql`${offers.visibility} = 'visible' and ${offers.status} = 'active' and ${offers.deletedAt} is null`);
  const ranked = await withOfferRanks(rows, "storefront");
  const itemsByOfferId = await listOrderedItemsByOfferRepo(ranked.map((row) => row.id));
  return ranked.map((row) => ({ ...row, items: itemsByOfferId.get(row.id) ?? [] }));
}

export async function findOfferBySlugRepo(slug: string) {
  const [row] = await db.select().from(offers).where(eq(offers.slug, slug)).limit(1);
  if (!row) return null;
  if (row.deletedAt || row.visibility !== "visible" || row.status !== "active") return null;
  const items = await listOrderedOfferItemsRepo(row.id);
  return { ...row, items };
}

export async function findOfferByIdRepo(id: number) {
  const [row] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!row) return null;
  const items = await listOrderedOfferItemsRepo(row.id);
  return { ...row, items };
}

export async function upsertOfferRepo(input: {
  id?: number;
  slug: string;
  arName: string;
  enName: string;
  arDescription?: string | null;
  enDescription?: string | null;
  imagePath?: string | null;
  fixedPrice: number;
  status: "active" | "inactive";
  visibility?: "visible" | "hidden";
  items: Array<{ id?: number; variantId: number; qty: number }>;
}) {
  const mergedItems = mergeOfferItems(input.items);
  return db.transaction(async (tx) => {
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
        imagePath: input.imagePath ?? null,
        fixedPrice: sql`${input.fixedPrice}`,
        status: input.status,
        visibility: input.visibility ?? "visible"
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
        imagePath: input.imagePath ?? null,
        fixedPrice: sql`${input.fixedPrice}`,
        status: input.status,
        visibility: input.visibility ?? "visible"
      })
      .$returningId();
    offerId = created.id;
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
  await db.update(offers).set({ deletedAt: null }).where(eq(offers.id, id));
}

export async function hardDeleteOfferRepo(id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ deletedAt: offers.deletedAt })
      .from(offers)
      .where(eq(offers.id, id))
      .limit(1);

    if (!existing || existing.deletedAt == null) {
      return false;
    }

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
    return true;
  });
}

export async function toggleOfferStatusRepo(id: number) {
  const [current] = await db.select({ status: offers.status }).from(offers).where(eq(offers.id, id)).limit(1);
  if (!current) return;
  await db
    .update(offers)
    .set({ status: current.status === "active" ? "inactive" : "active" })
    .where(eq(offers.id, id));
}
