import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("api route prefixes mount the live ERP and storefront paths", async () => {
  await withTestServer(app, async (request) => {
    const health = await request("/health");
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);

    const storefrontProducts = await request("/api/v1/products");
    assert.equal(storefrontProducts.status, 200);
    assert.ok(Array.isArray(storefrontProducts.json.items));

    const storefrontCategories = await request("/api/v1/categories");
    assert.equal(storefrontCategories.status, 200);
    assert.ok(Array.isArray(storefrontCategories.json.items));

    const storefrontOffers = await request("/api/v1/offers");
    assert.equal(storefrontOffers.status, 200);
    assert.ok(Array.isArray(storefrontOffers.json.items));

    const erpProducts = await request("/api/erp/products");
    assert.equal(erpProducts.status, 401);

    const erpOrders = await request("/api/erp/orders");
    assert.equal(erpOrders.status, 401);

    const erpUploads = await request("/api/erp/uploads", { method: "POST" });
    assert.equal(erpUploads.status, 401);
  });
});

test("stale catalog aggregate paths are not mounted under /api/v1", async () => {
  await withTestServer(app, async (request) => {
    const legacyProducts = await request("/api/v1/catalog/products");
    assert.equal(legacyProducts.status, 404);

    const legacyCategories = await request("/api/v1/catalog/categories");
    assert.equal(legacyCategories.status, 404);
  });
});
