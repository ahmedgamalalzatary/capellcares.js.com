import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { offerItems, offers } from "@capella/database/drizzle/schema";

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
  return db
    .select()
    .from(offers)
    .where(eq(offers.visibility, "visible"));
}

export async function findOfferBySlugRepo(slug: string) {
  const [row] = await db.select().from(offers).where(eq(offers.slug, slug)).limit(1);
  if (!row) return null;
  if (row.deletedAt || row.visibility !== "visible") return null;
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
  items: Array<{ variantId: number; qty: number }>;
}) {
  let offerId = input.id;
  if (offerId) {
    await db
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
    await db.delete(offerItems).where(eq(offerItems.offerId, offerId));
  } else {
    const [created] = await db
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
  if (input.items.length > 0) {
    await db.insert(offerItems).values(
      input.items.map((item) => ({ offerId: offerId!, variantId: item.variantId, qty: item.qty }))
    );
  }
  return { id: offerId! };
}

export async function softDeleteOfferRepo(id: number) {
  await db.update(offers).set({ deletedAt: sql`NOW()` }).where(eq(offers.id, id));
}

export async function restoreOfferRepo(id: number) {
  await db.update(offers).set({ deletedAt: null }).where(eq(offers.id, id));
}
