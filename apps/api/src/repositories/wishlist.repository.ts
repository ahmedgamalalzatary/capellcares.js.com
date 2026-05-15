import { and, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { wishlists } from "@capella/database/drizzle/schema";

export function listWishlistByCustomer(customerId: number) {
  return db.select().from(wishlists).where(eq(wishlists.customerId, customerId));
}

export async function addWishlistItem(customerId: number, productId: number) {
  const exists = await db
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(and(eq(wishlists.customerId, customerId), eq(wishlists.productId, productId)))
    .limit(1);
  if (exists.length === 0) {
    await db.insert(wishlists).values({ customerId, productId });
  }
}

export function removeWishlistItem(customerId: number, productId: number) {
  return db.delete(wishlists).where(and(eq(wishlists.customerId, customerId), eq(wishlists.productId, productId)));
}
