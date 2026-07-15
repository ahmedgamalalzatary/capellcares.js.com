import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@minikoshk/database/src/db";
import { collectionItems, collections } from "@minikoshk/database/drizzle/schema";
import { sql } from "drizzle-orm";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { findAdminProductByIdRepo } from "../../src/repositories/product.repository.js";
import { findOfferByIdRepo } from "../../src/repositories/offer.repository.js";
import { findCollectionByIdRepo } from "../../src/repositories/collection.repository.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("findAdminProductByIdRepo returns a single hydrated product by id", async () => {
  const ids = await getBaselineIds();

  const product = await findAdminProductByIdRepo(ids.productOneId);

  assert.ok(product);
  assert.equal(product.id, ids.productOneId);
  assert.ok(Array.isArray(product.keywords));
  assert.ok(Array.isArray(product.variants));
  assert.deepEqual(product.sizes.map((size) => size.label), ["100ml"]);
  assert.deepEqual(product.colors, []);
  assert.equal(product.variants[0]?.sizeId, product.sizes[0]?.id);
  assert.equal(product.variants[0]?.colorId, null);
});

test("findOfferByIdRepo returns a single hydrated offer by id", async () => {
  const ids = await getBaselineIds();

  const offer = await findOfferByIdRepo(ids.offerId);

  assert.ok(offer);
  assert.equal(offer.id, ids.offerId);
  assert.ok(Array.isArray(offer.items));
});

test("findCollectionByIdRepo returns a single hydrated collection by id", async () => {
  const ids = await getBaselineIds();

  const [created] = await db
    .insert(collections)
    .values({
      slug: `repo-detail-collection-${Date.now()}`,
      arName: "مجموعة مستودع",
      enName: "Repository Collection",
      fixedPrice: sql`120`,
      categoryId: ids.leafCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();

  await db.insert(collectionItems).values([
    { collectionId: created.id, variantId: ids.firstVariantId, qty: 1 },
    { collectionId: created.id, variantId: ids.secondVariantId, qty: 1 }
  ]);

  const collection = await findCollectionByIdRepo(created.id);

  assert.ok(collection);
  assert.equal(collection.id, created.id);
  assert.ok(Array.isArray(collection.items));
});
