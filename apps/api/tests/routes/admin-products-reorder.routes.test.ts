import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq, isNull } from "drizzle-orm";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { entityOrderings, products } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function insertExtraProduct(input: { categoryId: number; sku: string; slug: string }) {
  const [created] = await db
    .insert(products)
    .values({
      sku: input.sku,
      slug: input.slug,
      arName: "منتج إضافي",
      enName: "Extra Product",
      buyingPrice: "10.00",
      keywords: "extra",
      status: "active",
      categoryId: input.categoryId
    })
    .$returningId();
  return created.id;
}

test("admin product reorder persists root ordering ranks", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: null,
        ids: [ids.productTwoId, ids.productOneId]
      })
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { ok: true });
  });

  const rows = await db
    .select({ entityId: entityOrderings.entityId, rank: entityOrderings.rank })
    .from(entityOrderings)
    .where(
      and(
        eq(entityOrderings.scopeType, "root"),
        isNull(entityOrderings.scopeId),
        eq(entityOrderings.entityType, "product")
      )
    );

  const rankByProductId = new Map(rows.map((row) => [row.entityId, row.rank]));
  assert.equal(rankByProductId.get(ids.productTwoId), 1);
  assert.equal(rankByProductId.get(ids.productOneId), 2);
});

test("admin product reorder persists category-scoped ranks including descendant products", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    // Products live in the leaf category; reorder happens in the parent scope.
    const response = await request("/api/erp/products/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: ids.rootCategoryId,
        ids: [ids.productTwoId, ids.productOneId]
      })
    });

    assert.equal(response.status, 200);
  });

  const rows = await db
    .select({ entityId: entityOrderings.entityId, rank: entityOrderings.rank })
    .from(entityOrderings)
    .where(
      and(
        eq(entityOrderings.scopeType, "category"),
        eq(entityOrderings.scopeId, ids.rootCategoryId),
        eq(entityOrderings.entityType, "product")
      )
    );

  const rankByProductId = new Map(rows.map((row) => [row.entityId, row.rank]));
  assert.equal(rankByProductId.get(ids.productTwoId), 1);
  assert.equal(rankByProductId.get(ids.productOneId), 2);
});

test("admin product reorder rejects duplicate ids", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: null,
        ids: [ids.productOneId, ids.productOneId]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-product-order");
  });
});

test("admin product reorder rejects an incomplete scope set", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: null,
        ids: [ids.productOneId]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-product-order");
  });
});

test("admin product list returns ranked products first with per-scope orderings", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    const reorderResponse = await request("/api/erp/products/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: null,
        ids: [ids.productTwoId, ids.productOneId]
      })
    });
    assert.equal(reorderResponse.status, 200);

    const unrankedId = await insertExtraProduct({
      categoryId: ids.leafCategoryId,
      sku: `EXTRA-${Date.now()}`,
      slug: `extra-product-${Date.now()}`
    });

    const response = await request("/api/erp/products", { headers: { ...authHeaders } });
    assert.equal(response.status, 200);

    const listedIds = response.json.items.map((item: { id: number }) => item.id);
    const productTwoIndex = listedIds.indexOf(ids.productTwoId);
    const productOneIndex = listedIds.indexOf(ids.productOneId);
    const unrankedIndex = listedIds.indexOf(unrankedId);

    assert.ok(productTwoIndex !== -1 && productOneIndex !== -1 && unrankedIndex !== -1);
    assert.ok(productTwoIndex < productOneIndex, "rank 1 product should come before rank 2");
    assert.ok(unrankedIndex > productOneIndex, "unranked product should come after ranked products");

    const rankedItem = response.json.items.find((item: { id: number }) => item.id === ids.productTwoId);
    assert.ok(Array.isArray(rankedItem.orderings), "items should expose their ordering rows");
    const rootOrdering = rankedItem.orderings.find(
      (entry: { scopeType: string }) => entry.scopeType === "root"
    );
    assert.equal(rootOrdering?.rank, 1);
  });
});

test("storefront product list orders by root ranks then newest-first fallback", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const reorderResponse = await request("/api/erp/products/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: null,
        ids: [ids.productTwoId, ids.productOneId]
      })
    });
    assert.equal(reorderResponse.status, 200);

    const unrankedId = await insertExtraProduct({
      categoryId: ids.leafCategoryId,
      sku: `EXTRA-SF-${Date.now()}`,
      slug: `extra-storefront-${Date.now()}`
    });

    const response = await request("/api/v1/products");
    assert.equal(response.status, 200);

    const listedIds = response.json.items.map((item: { id: number }) => item.id);
    assert.deepEqual(
      listedIds.filter((id: number) => [ids.productOneId, ids.productTwoId, unrankedId].includes(id)),
      [ids.productTwoId, ids.productOneId, unrankedId]
    );
  });
});

test("storefront category product list uses that category's scoped ranks", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const reorderResponse = await request("/api/erp/products/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        categoryId: ids.rootCategoryId,
        ids: [ids.productTwoId, ids.productOneId]
      })
    });
    assert.equal(reorderResponse.status, 200);

    const response = await request("/api/v1/products?category=body-care");
    assert.equal(response.status, 200);

    const listedIds = response.json.items.map((item: { id: number }) => item.id);
    assert.deepEqual(
      listedIds.filter((id: number) => [ids.productOneId, ids.productTwoId].includes(id)),
      [ids.productTwoId, ids.productOneId]
    );
  });
});

test("storefront category product list also accepts categoryId for unambiguous filtering", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/products?categoryId=${ids.rootCategoryId}`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.json.items));
    assert.ok(response.json.items.length > 0);
  });
});
