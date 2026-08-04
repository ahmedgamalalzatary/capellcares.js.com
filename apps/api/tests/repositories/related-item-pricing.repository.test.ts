import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { categories, collectionItems, productVariants, variantDiscounts } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  getStorefrontRelatedCardsRepo,
  setRelatedLinksForSourceRepo
} from "../../src/repositories/related-item.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("getStorefrontRelatedCardsRepo prices a related product at its active discounted price, not the original selling price", async () => {
  const ids = await getBaselineIds();

  // Baseline product one's variant sells for 35.00; apply a 50% active discount -> 17.50.
  await db.insert(variantDiscounts).values({
    variantId: ids.firstVariantId,
    type: "percentage",
    value: "50",
    startsAt: new Date("2000-01-01T00:00:00.000Z"),
    endsAt: new Date("2999-01-01T00:00:00.000Z"),
    status: "active"
  });

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.price, 17.5);
});

test("getStorefrontRelatedCardsRepo carries the cheapest in-stock variant so the card can add to cart", async () => {
  const ids = await getBaselineIds();

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.variantId, ids.firstVariantId);
});

test("getStorefrontRelatedCardsRepo skips a cheaper out-of-stock variant when choosing what the card adds", async () => {
  const ids = await getBaselineIds();

  // Cheapest of the three, but nothing on the shelf — must not win.
  await db.insert(productVariants).values({
    productId: ids.productOneId,
    sizeLabel: "10ml",
    sellingPrice: "5.00",
    stockQty: 0
  });
  const [midVariant] = await db.insert(productVariants).values({
    productId: ids.productOneId,
    sizeLabel: "50ml",
    sellingPrice: "20.00",
    stockQty: 4
  }).$returningId();

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  // 20.00 beats the baseline 35.00 and the unavailable 5.00.
  assert.equal(productOneCard?.price, 20);
  assert.equal(productOneCard?.variantId, midVariant!.id);
});

test("getStorefrontRelatedCardsRepo never offers a soft-deleted variant, which checkout would reject", async () => {
  const ids = await getBaselineIds();

  // Soft delete leaves stockQty untouched, so only deletedAt rules this out.
  await db.insert(productVariants).values({
    productId: ids.productOneId,
    sizeLabel: "10ml",
    sellingPrice: "5.00",
    stockQty: 9,
    deletedAt: new Date("2026-01-01T00:00:00.000Z")
  });

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.variantId, ids.firstVariantId);
  assert.equal(productOneCard?.price, 35);
});

test("getStorefrontRelatedCardsRepo drops a sold-out offer, as it already does for collections", async () => {
  const ids = await getBaselineIds();

  // The baseline offer bundles both variants; empty one and no bundle can ship.
  await db
    .update(productVariants)
    .set({ stockQty: 0 })
    .where(eq(productVariants.id, ids.secondVariantId));

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "offer", id: ids.offerId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productOneId });

  assert.equal(cards.find((card) => card.type === "offer"), undefined);
});

test("getStorefrontRelatedCardsRepo drops a bundle whose part was soft-deleted, not just one that is out of stock", async () => {
  const ids = await getBaselineIds();

  // Soft-deleting a part leaves its stock_qty intact. Skipping the row entirely
  // would make the bundle look shippable from its surviving parts alone.
  await db
    .update(productVariants)
    .set({ deletedAt: new Date("2026-01-01T00:00:00.000Z") })
    .where(eq(productVariants.id, ids.secondVariantId));

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "offer", id: ids.offerId },
    { type: "collection", id: ids.collectionId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productOneId });

  assert.equal(cards.find((card) => card.type === "offer"), undefined);
  assert.equal(cards.find((card) => card.type === "collection"), undefined);
});

test("getStorefrontRelatedCardsRepo drops a bundle that has no items at all", async () => {
  const ids = await getBaselineIds();

  await db.delete(collectionItems).where(eq(collectionItems.collectionId, ids.collectionId));

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "collection", id: ids.collectionId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productOneId });

  assert.equal(cards.find((card) => card.type === "collection"), undefined);
});

test("getStorefrontRelatedCardsRepo breaks an effective-price tie on sort order, so the card always adds the same SKU", async () => {
  const ids = await getBaselineIds();

  // Same effective price as the baseline variant (35.00), but ranked ahead of it
  // while carrying a HIGHER id — so only an explicit sort order can pick it, not
  // the natural row order the database happens to return.
  const [earlyVariant] = await db.insert(productVariants).values({
    productId: ids.productOneId,
    sizeLabel: "60ml",
    sellingPrice: "35.00",
    stockQty: 3,
    sortOrder: -1
  }).$returningId();

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.variantId, earlyVariant!.id);
});

test("getStorefrontRelatedCardsRepo does not name a soft-deleted category", async () => {
  const ids = await getBaselineIds();

  await db
    .update(categories)
    .set({ deletedAt: new Date("2026-01-01T00:00:00.000Z") })
    .where(eq(categories.id, ids.leafCategoryId));

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.categoryName, null);
});

test("getStorefrontRelatedCardsRepo reports a discounted product's pre-discount price as originalTotal", async () => {
  const ids = await getBaselineIds();

  // Baseline product one's variant sells for 35.00; a 50% discount prices it at 17.50.
  await db.insert(variantDiscounts).values({
    variantId: ids.firstVariantId,
    type: "percentage",
    value: "50",
    startsAt: new Date("2000-01-01T00:00:00.000Z"),
    endsAt: new Date("2999-01-01T00:00:00.000Z"),
    status: "active"
  });

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.originalTotal, 35);
});

test("getStorefrontRelatedCardsRepo leaves originalTotal null for an undiscounted product", async () => {
  const ids = await getBaselineIds();

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.equal(productOneCard?.originalTotal, null);
});

test("getStorefrontRelatedCardsRepo names a related product's category for the card's classification line", async () => {
  const ids = await getBaselineIds();

  const [category] = await db
    .select({ arName: categories.arName, enName: categories.enName })
    .from(categories)
    .where(eq(categories.id, ids.leafCategoryId))
    .limit(1);

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productTwoId }, [
    { type: "product", id: ids.productOneId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productTwoId });
  const productOneCard = cards.find((card) => card.type === "product" && card.id === ids.productOneId);

  assert.deepEqual(productOneCard?.categoryName, { ar: category!.arName, en: category!.enName });
});

test("getStorefrontRelatedCardsRepo leaves categoryName null for bundles, which show no category line", async () => {
  const ids = await getBaselineIds();

  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "offer", id: ids.offerId },
    { type: "collection", id: ids.collectionId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productOneId });

  assert.equal(cards.find((card) => card.type === "offer")?.categoryName, null);
  assert.equal(cards.find((card) => card.type === "collection")?.categoryName, null);
});

test("getStorefrontRelatedCardsRepo totals a bundle's parts as originalTotal and has no variant to add", async () => {
  const ids = await getBaselineIds();

  // The baseline offer and collection both bundle the 35.00 and 55.00 variants.
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "offer", id: ids.offerId },
    { type: "collection", id: ids.collectionId }
  ]);

  const cards = await getStorefrontRelatedCardsRepo({ type: "product", id: ids.productOneId });
  const offerCard = cards.find((card) => card.type === "offer");
  const collectionCard = cards.find((card) => card.type === "collection");

  assert.equal(offerCard?.price, 70);
  assert.equal(offerCard?.originalTotal, 90);
  assert.equal(offerCard?.variantId, null);
  assert.equal(collectionCard?.price, 65);
  assert.equal(collectionCard?.originalTotal, 90);
  assert.equal(collectionCard?.variantId, null);
});
