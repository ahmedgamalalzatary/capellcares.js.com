import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { app } from "../../src/app.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { updateAdminUserPermissions } from "../../src/services/erp-permissions.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { eq, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { collections, offers } from "@capella/database/drizzle/schema";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("bulk discount applies once to products, offers, and collections selected through overlapping categories and IDs", async () => {
  const ids = await getBaselineIds();
  const now = Date.now();
  await withTestServer(app, async (request) => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/discounts/bulk", {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        productIds: [ids.productOneId],
        offerIds: [ids.offerId],
        collectionIds: [],
        categoryIds: [ids.rootCategoryId, ids.leafCategoryId],
        discount: {
          type: "percentage", value: 20,
          startsAt: new Date(now - 86_400_000).toISOString(),
          endsAt: new Date(now + 86_400_000).toISOString(),
          status: "active"
        }
      })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.counts, { variants: 2, offers: 1, collections: 1 });

    const [products, offers, collections] = await Promise.all([
      request("/api/erp/products", { headers: auth }),
      request("/api/erp/offers", { headers: auth }),
      request("/api/erp/collections", { headers: auth })
    ]);
    for (const product of products.json.items.filter((item: { id: number }) =>
      item.id === ids.productOneId || item.id === ids.productTwoId)) {
      assert.equal(product.variants[0].discount.value, 20);
    }
    const adminOffer = offers.json.items.find((item: { id: number }) => item.id === ids.offerId);
    const adminCollection = collections.json.items.find((item: { id: number }) => item.id === ids.collectionId);
    assert.equal(adminOffer.discount.value, 20);
    assert.equal(adminCollection.discount.value, 20);
    assert.equal(adminOffer.price, 70);
    assert.equal(adminCollection.price, 65);
    const [storeOffers, storeCollections] = await Promise.all([
      request("/api/v1/offers"),
      request("/api/v1/collections")
    ]);
    assert.equal(storeOffers.json.items.find((item: { id: number }) => item.id === ids.offerId).price, 56);
    assert.equal(storeCollections.json.items.find((item: { id: number }) => item.id === ids.collectionId).price, 52);
  });
});

test("bulk discount excludes reviewed targets from a category selection", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/discounts/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        categoryIds: [ids.rootCategoryId],
        excludeVariantIds: [ids.secondVariantId],
        excludeOfferIds: [ids.offerId],
        discount: { type: "percentage", value: 10, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", status: "active" }
      })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.counts, { variants: 1, offers: 0, collections: 1 });
  });
});

test("bulk discount rejects a fixed amount that exceeds any target without changing other targets", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/discounts/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        productIds: [ids.productOneId, ids.productTwoId],
        discount: { type: "fixed", value: 40, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", status: "active" }
      })
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "discount-exceeds-price");
    const products = await request("/api/erp/products", { headers: auth });
    for (const product of products.json.items.filter((item: { id: number }) =>
      item.id === ids.productOneId || item.id === ids.productTwoId)) {
      assert.equal(product.variants[0].discount, null);
    }
  });
});

test("bulk discount can remove existing discounts from mixed selected items", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const auth = await getAdminAuthHeaders(request);
    const selection = { productIds: [ids.productOneId], offerIds: [ids.offerId], collectionIds: [ids.collectionId] };
    const headers = { ...auth, "content-type": "application/json" };
    const applied = await request("/api/erp/discounts/bulk", { method: "POST", headers, body: JSON.stringify({
      ...selection, discount: { type: "percentage", value: 20, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", status: "active" }
    }) });
    assert.equal(applied.status, 200);
    const removed = await request("/api/erp/discounts/bulk", { method: "POST", headers, body: JSON.stringify({ ...selection, discount: null }) });
    assert.equal(removed.status, 200);
    const [products, offers, collections] = await Promise.all([
      request("/api/erp/products", { headers: auth }), request("/api/erp/offers", { headers: auth }), request("/api/erp/collections", { headers: auth })
    ]);
    assert.equal(products.json.items.find((item: { id: number }) => item.id === ids.productOneId).variants[0].discount, null);
    assert.equal(offers.json.items.find((item: { id: number }) => item.id === ids.offerId).discount, null);
    assert.equal(collections.json.items.find((item: { id: number }) => item.id === ids.collectionId).discount, null);
  });
});

test("product-only discount permission cannot apply a mixed bulk discount", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const staff = await getStaffAuthHeaders(request);
    await updateAdminUserPermissions(staff.user.email, ["products.discount"]);
    const response = await request("/api/erp/discounts/bulk", {
      method: "POST", headers: { authorization: staff.authorization, "content-type": "application/json" },
      body: JSON.stringify({ productIds: [ids.productOneId], offerIds: [ids.offerId],
        discount: { type: "percentage", value: 10, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", status: "active" }
      })
    });
    assert.equal(response.status, 403);
  });
});

test("staff with bulk discount permission can apply a mixed discount", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const staff = await getStaffAuthHeaders(request);
    await updateAdminUserPermissions(staff.user.email, ["discounts.manage"]);
    const response = await request("/api/erp/discounts/bulk", {
      method: "POST", headers: { authorization: staff.authorization, "content-type": "application/json" },
      body: JSON.stringify({ productIds: [ids.productOneId], offerIds: [ids.offerId], collectionIds: [ids.collectionId],
        discount: { type: "percentage", value: 10, startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2027-01-01T00:00:00.000Z", status: "active" }
      })
    });
    assert.equal(response.status, 200);
  });
});

test("bulk discount rejects a zero-priced offer even for a percentage discount", async () => {
  const ids = await getBaselineIds();
  await db.update(offers).set({ fixedPrice: sql`0` }).where(eq(offers.id, ids.offerId));
  await withTestServer(app, async (request) => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/discounts/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ offerIds: [ids.offerId], discount: {
        type: "percentage", value: 20, startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2027-01-01T00:00:00.000Z", status: "active"
      } })
    });
    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "discount-exceeds-price");
  });
});

test("editing an offer or collection cannot make its existing fixed discount exceed its selling price", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const auth = await getAdminAuthHeaders(request);
    const headers = { ...auth, "content-type": "application/json" };
    const applied = await request("/api/erp/discounts/bulk", {
      method: "POST", headers,
      body: JSON.stringify({ offerIds: [ids.offerId], collectionIds: [ids.collectionId], discount: {
        type: "fixed", value: 40, startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2027-01-01T00:00:00.000Z", status: "active"
      } })
    });
    assert.equal(applied.status, 200);
    for (const [path, id] of [["offers", ids.offerId], ["collections", ids.collectionId]] as const) {
      const before = await request(`/api/erp/${path}/${id}`, { headers: auth });
      assert.equal(before.status, 200);
      const bundle = before.json;
      const updated = await request(`/api/erp/${path}`, {
        method: "POST", headers,
        body: JSON.stringify({ ...bundle, categoryId: ids.rootCategoryId, price: 30 })
      });
      assert.equal(updated.status, 400);
      assert.equal(updated.json.reason, "discount-exceeds-price");
    }
    const [offer] = await db.select({ price: offers.fixedPrice }).from(offers).where(eq(offers.id, ids.offerId));
    const [collection] = await db.select({ price: collections.fixedPrice }).from(collections).where(eq(collections.id, ids.collectionId));
    assert.equal(Number(offer.price), 70);
    assert.equal(Number(collection.price), 65);
  });
});
