import { eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { offerItems, offers } from "@capella/database/drizzle/schema";

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
  return Promise.all(
    rows.map(async (row) => {
      const items = await db.select().from(offerItems).where(eq(offerItems.offerId, row.id));
      return { ...row, items };
    })
  );
}

export async function listVisibleOffersRepo() {
  const rows = await db
    .select()
    .from(offers)
    .where(sql`${offers.visibility} = 'visible' and ${offers.status} = 'active' and ${offers.deletedAt} is null`);
  return Promise.all(
    rows.map(async (row) => {
      const items = await db.select().from(offerItems).where(eq(offerItems.offerId, row.id));
      return { ...row, items };
    })
  );
}

export async function findOfferBySlugRepo(slug: string) {
  const [row] = await db.select().from(offers).where(eq(offers.slug, slug)).limit(1);
  if (!row) return null;
  if (row.deletedAt || row.visibility !== "visible" || row.status !== "active") return null;
  const items = await db.select().from(offerItems).where(eq(offerItems.offerId, row.id));
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
  return { id: offerId! };
  });
}

export async function softDeleteOfferRepo(id: number) {
  await db.update(offers).set({ deletedAt: sql`NOW()` }).where(eq(offers.id, id));
}

export async function restoreOfferRepo(id: number) {
  await db.update(offers).set({ deletedAt: null }).where(eq(offers.id, id));
}

export async function toggleOfferStatusRepo(id: number) {
  const [current] = await db.select({ status: offers.status }).from(offers).where(eq(offers.id, id)).limit(1);
  if (!current) return;
  await db
    .update(offers)
    .set({ status: current.status === "active" ? "inactive" : "active" })
    .where(eq(offers.id, id));
}
