import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import {
  categories,
  collectionItems,
  collections,
  offerItems,
  offers
} from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";

function searchPattern(query: string) {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function searchVisibleCategoriesRepo(query: string, limit = 4) {
  const pattern = searchPattern(query);
  return db
    .select()
    .from(categories)
    .where(and(
      isNull(categories.deletedAt),
      or(
        sql`${categories.arName} LIKE ${pattern}`,
        sql`${categories.enName} LIKE ${pattern}`
      )
    ))
    .orderBy(asc(categories.sortOrder), asc(categories.id))
    .limit(limit);
}

export async function searchVisibleOffersRepo(query: string, limit = 3) {
  const pattern = searchPattern(query);
  const rows = await db
    .select()
    .from(offers)
    .where(and(
      eq(offers.status, "active"),
      eq(offers.visibility, "visible"),
      isNull(offers.deletedAt),
      or(
        sql`${offers.arName} LIKE ${pattern}`,
        sql`${offers.enName} LIKE ${pattern}`,
        sql`${offers.arDescription} LIKE ${pattern}`,
        sql`${offers.enDescription} LIKE ${pattern}`
      )
    ))
    .orderBy(asc(offers.id))
    .limit(limit);
  return Promise.all(rows.map(async (row) => ({
    ...row,
    items: await db.select().from(offerItems).where(eq(offerItems.offerId, row.id))
  })));
}

export async function searchVisibleCollectionsRepo(query: string, limit = 3) {
  const pattern = searchPattern(query);
  const rows = await db
    .select()
    .from(collections)
    .where(and(
      eq(collections.status, "active"),
      eq(collections.visibility, "visible"),
      isNull(collections.deletedAt),
      or(
        sql`${collections.arName} LIKE ${pattern}`,
        sql`${collections.enName} LIKE ${pattern}`,
        sql`${collections.arDescription} LIKE ${pattern}`,
        sql`${collections.enDescription} LIKE ${pattern}`
      )
    ))
    .orderBy(asc(collections.id))
    .limit(limit);
  return Promise.all(rows.map(async (row) => ({
    ...row,
    items: await db.select().from(collectionItems).where(eq(collectionItems.collectionId, row.id))
  })));
}
