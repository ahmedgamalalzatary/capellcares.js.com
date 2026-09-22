import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { bundleDiscounts, collections, offers } from "@capella/database/drizzle/schema";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class BundleDiscountPriceError extends Error {
  readonly reason = "discount-exceeds-price";
  constructor() { super("discount-exceeds-price"); }
}

export async function validateExistingBundleDiscountPrice(tx: DbTransaction, type: "offer" | "collection", id: number, price: number) {
  if (type === "offer") {
    await tx.select({ id: offers.id }).from(offers).where(eq(offers.id, id)).limit(1).for("update");
  } else {
    await tx.select({ id: collections.id }).from(collections).where(eq(collections.id, id)).limit(1).for("update");
  }
  const owner = type === "offer" ? bundleDiscounts.offerId : bundleDiscounts.collectionId;
  const [discount] = await tx.select({ type: bundleDiscounts.type, value: bundleDiscounts.value })
    .from(bundleDiscounts).where(eq(owner, id)).limit(1).for("update");
  if (discount && (price <= 0 || (discount.type === "fixed" && Number(discount.value) >= price))) {
    throw new BundleDiscountPriceError();
  }
}
