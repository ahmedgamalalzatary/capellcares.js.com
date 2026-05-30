import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { eq } from "drizzle-orm";
import { products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { setRelatedLinksForSourceRepo } from "../../src/repositories/related-item.repository.js";
import { withTestServer } from "../helpers/request.js";
import {
  assertConformsTo,
  assertForbiddenFieldsAbsent,
  storefrontCategoryContract,
  storefrontOfferContract,
  storefrontProductContract,
  storefrontRelatedItemContract
} from "@capella/shared/tests/contracts";

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

test("storefront category endpoints conform to the shared category contract", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/categories");
    assertConformsTo(response.json.items[0], storefrontCategoryContract);
  });
});
