import { inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { bundleDiscounts } from "@capella/database/drizzle/schema";
import type { VariantDiscount } from "@capella/shared";

export async function loadBundleDiscountsRepo(type: "offer" | "collection", ids: number[]) {
  const discounts = new Map<number, VariantDiscount>();
  if (ids.length === 0) return discounts;
  const column = type === "offer" ? bundleDiscounts.offerId : bundleDiscounts.collectionId;
  const rows = await db.select().from(bundleDiscounts).where(inArray(column, ids));
  for (const row of rows) {
    const id = type === "offer" ? row.offerId : row.collectionId;
    if (id == null) continue;
    discounts.set(id, {
      id: row.id,
      type: row.type,
      value: Number(row.value),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status
    });
  }
  return discounts;
}
