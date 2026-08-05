import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  collectionItems,
  collections,
  offers,
  products
} from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import { eq } from "drizzle-orm";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function seedSearchableCatalog() {
  const ids = await getBaselineIds();
  await db
    .update(products)
    .set({
      enDescription: "Universalterm product description",
      arDescription: "مصطلحشامل وصف المنتج"
    })
    .where(eq(products.id, ids.productOneId));
  await db
    .update(offers)
    .set({
      enDescription: "Universalterm offer description",
      arDescription: "مصطلحشامل وصف العرض"
    })
    .where(eq(offers.id, ids.offerId));

  const [collection] = await db.insert(collections).values({
    slug: "searchable-collection",
    arName: "مجموعة مصطلحشامل",
    enName: "Universalterm Collection",
    arDescription: "مصطلحشامل وصف المجموعة",
    enDescription: "Universalterm collection description",
    fixedPrice: "40.00",
    categoryId: ids.leafCategoryId,
    status: "active",
    visibility: "visible"
  }).$returningId();
  await db.insert(collectionItems).values({
    collectionId: collection.id,
    variantId: ids.firstVariantId,
    qty: 1
  });

  await db.insert(offers).values({
    slug: "hidden-search-offer",
    arName: "مصطلحشامل مخفي",
    enName: "Universalterm Hidden",
    fixedPrice: "10.00",
    status: "active",
    visibility: "hidden"
  });
}

test("global search finds every storefront entity in English while the storefront is Arabic", async () => {
  await seedSearchableCatalog();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/search?q=universalterm", {
      headers: { "x-lang": "ar" }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json.products.map((item: any) => item.slug), ["test-product-baseline-1"]);
    assert.deepEqual(response.json.offers.map((item: any) => item.slug), ["test-offer-baseline"]);
    assert.deepEqual(response.json.collections.map((item: any) => item.slug), ["searchable-collection"]);
    assert.equal(response.json.offers.some((item: any) => item.slug === "hidden-search-offer"), false);
  });
});

test("global search finds Arabic content while the storefront is English", async () => {
  await seedSearchableCatalog();

  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/search?q=${encodeURIComponent("مصطلحشامل")}`, {
      headers: { "x-lang": "en" }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json.products.map((item: any) => item.slug), ["test-product-baseline-1"]);
    assert.deepEqual(response.json.offers.map((item: any) => item.slug), ["test-offer-baseline"]);
    assert.deepEqual(response.json.collections.map((item: any) => item.slug), ["searchable-collection"]);
  });
});

test("global search matches category names and rejects blank queries", async () => {
  await withTestServer(app, async (request) => {
    const found = await request("/api/v1/search?q=body");
    assert.equal(found.status, 200);
    assert.deepEqual(found.json.categories.map((item: any) => item.slug), ["body-care", "body-lotion"]);

    const blank = await request("/api/v1/search?q=%20%20");
    assert.equal(blank.status, 400);
  });
});
