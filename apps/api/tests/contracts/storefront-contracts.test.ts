import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { eq } from "drizzle-orm";
import { categories, products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { setRelatedLinksForSourceRepo } from "../../src/repositories/related-item.repository.js";
import { withTestServer } from "../helpers/request.js";
import {
  assertConformsTo,
  assertForbiddenFieldsAbsent,
  storefrontCategoryContract,
  storefrontCollectionContract,
  storefrontOfferContract,
  storefrontProductContract,
  storefrontRelatedItemContract
} from "@capella/shared/tests/contracts";
import { collectionItems, collections } from "@capella/database/drizzle/schema";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("storefront product endpoints conform to the shared product contract", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/products");
    const product = response.json.items[0];
    assertConformsTo(product, storefrontProductContract);
    assertForbiddenFieldsAbsent(product, ["buyingPrice"]);
    assert.ok(Array.isArray(product.media), "expected product media array");
    assert.ok(product.media.length > 0, "expected product to expose at least one media item");
    assert.deepEqual(product.media[0], {
      type: "image",
      url: product.imagePath
    });
  });
});

test("storefront offer endpoints conform to the shared offer contract", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/offers");
    const offer = response.json.items[0];
    assertConformsTo(offer, storefrontOfferContract);
    assert.equal(typeof offer.stock, "number");
  });
});

test("storefront collection endpoints conform to the shared collection contract", async () => {
  const ids = await getBaselineIds();
  const [createdCollection] = await db
    .insert(collections)
    .values({
      slug: `contract-collection-${Date.now()}`,
      arName: "مجموعة العقود",
      enName: "Contract Collection",
      fixedPrice: "90.00",
      categoryId: ids.leafCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  await db.insert(collectionItems).values([
    { collectionId: createdCollection.id, variantId: ids.firstVariantId, qty: 1 },
    { collectionId: createdCollection.id, variantId: ids.secondVariantId, qty: 1 }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/collections");
    const collection = response.json.items.find((item: any) => item.id === createdCollection.id);
    assert.ok(collection, "expected created collection in storefront list");
    assertConformsTo(collection, storefrontCollectionContract);
  });
});

test("storefront product detail returns related items in this product's rank order", async () => {
  const ids = await getBaselineIds();
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId },
    { type: "offer", id: ids.offerId }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/products/test-product-baseline-1");
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.json.relatedItems), "expected relatedItems array");
    response.json.relatedItems.forEach((item: unknown) => assertConformsTo(item, storefrontRelatedItemContract));
    assert.deepEqual(
      response.json.relatedItems.map((item: any) => ({ type: item.type, id: item.id })),
      [
        { type: "product", id: ids.productTwoId },
        { type: "offer", id: ids.offerId }
      ]
    );
  });
});

test("storefront product detail hides inactive related targets but keeps rank order (gaps)", async () => {
  const ids = await getBaselineIds();
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId },
    { type: "offer", id: ids.offerId }
  ]);
  // Hide the rank-1 target; the rank-2 offer must still render, order preserved.
  await db.update(products).set({ status: "inactive" }).where(eq(products.id, ids.productTwoId));

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/products/test-product-baseline-1");
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.json.relatedItems.map((item: any) => ({ type: item.type, id: item.id })),
      [{ type: "offer", id: ids.offerId }]
    );
  });
});

test("storefront offer detail returns its related items", async () => {
  const ids = await getBaselineIds();
  await setRelatedLinksForSourceRepo({ type: "offer", id: ids.offerId }, [
    { type: "product", id: ids.productOneId }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/offers/test-offer-baseline");
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.json.relatedItems), "expected relatedItems array");
    assert.deepEqual(
      response.json.relatedItems.map((item: any) => ({ type: item.type, id: item.id })),
      [{ type: "product", id: ids.productOneId }]
    );
  });
});

test("storefront collection detail returns its related items", async () => {
  const ids = await getBaselineIds();
  const slug = `related-collection-${Date.now()}`;
  const [createdCollection] = await db
    .insert(collections)
    .values({
      slug,
      arName: "مجموعة علاقات",
      enName: "Related Collection",
      fixedPrice: "90.00",
      categoryId: ids.leafCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  await db.insert(collectionItems).values([
    { collectionId: createdCollection.id, variantId: ids.firstVariantId, qty: 1 },
    { collectionId: createdCollection.id, variantId: ids.secondVariantId, qty: 1 }
  ]);
  await setRelatedLinksForSourceRepo({ type: "collection", id: createdCollection.id }, [
    { type: "product", id: ids.productOneId }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/collections/${slug}`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.json.relatedItems), "expected relatedItems array");
    assert.deepEqual(
      response.json.relatedItems.map((item: any) => ({ type: item.type, id: item.id })),
      [{ type: "product", id: ids.productOneId }]
    );
  });
});

test("storefront category endpoints conform to the shared category contract", async () => {
  const ids = await getBaselineIds();
  await db
    .update(categories)
    .set({ imagePath: "/uploads/storefront-category.jpg" })
    .where(eq(categories.id, ids.leafCategoryId));

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/categories");
    assertConformsTo(response.json.items[0], storefrontCategoryContract);
    assert.equal(typeof response.json.items[0].sortOrder, "number");
    const updatedLeaf = response.json.items.find((item: any) => item.id === ids.leafCategoryId);
    assert.equal(updatedLeaf?.imagePath, "/uploads/storefront-category.jpg");
  });
});
