import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import {
  assertConformsTo,
  assertForbiddenFieldsAbsent,
  storefrontCategoryContract,
  storefrontOfferContract,
  storefrontProductContract
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

test("storefront category endpoints conform to the shared category contract", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/categories");
    assertConformsTo(response.json.items[0], storefrontCategoryContract);
  });
});
