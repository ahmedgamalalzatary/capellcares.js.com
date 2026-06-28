import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq, isNull } from "drizzle-orm";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { collections, entityOrderings, offers } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function insertOffer(slug: string) {
  const [created] = await db
    .insert(offers)
    .values({
      slug,
      arName: "عرض",
      enName: "Offer",
      fixedPrice: "100.00",
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  return created.id;
}

async function insertCollection(slug: string, categoryId: number) {
  const [created] = await db
    .insert(collections)
    .values({
      slug,
      arName: "كولكشن",
      enName: "Collection",
      fixedPrice: "150.00",
      categoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  return created.id;
}

test("admin offer reorder persists root ordering ranks", async () => {
  const ids = await getBaselineIds();
  const secondOfferId = await insertOffer(`second-offer-${Date.now()}`);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ids: [secondOfferId, ids.offerId] })
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
        eq(entityOrderings.entityType, "offer")
      )
    );

  const rankByOfferId = new Map(rows.map((row) => [row.entityId, row.rank]));
  assert.equal(rankByOfferId.get(secondOfferId), 1);
  assert.equal(rankByOfferId.get(ids.offerId), 2);
});

test("admin offer reorder rejects an incomplete set", async () => {
  const ids = await getBaselineIds();
  await insertOffer(`other-offer-${Date.now()}`);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ids: [ids.offerId] })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-offer-order");
  });
});

test("admin offers list returns ranked offers first", async () => {
  const ids = await getBaselineIds();
  const secondOfferId = await insertOffer(`ranked-offer-${Date.now()}`);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const reorderResponse = await request("/api/erp/offers/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ids: [secondOfferId, ids.offerId] })
    });
    assert.equal(reorderResponse.status, 200);

    const unrankedOfferId = await insertOffer(`unranked-offer-${Date.now()}`);

    const response = await request("/api/erp/offers", { headers: { ...authHeaders } });
    assert.equal(response.status, 200);

    const listedIds = response.json.items.map((item: { id: number }) => item.id);
    const secondIndex = listedIds.indexOf(secondOfferId);
    const baselineIndex = listedIds.indexOf(ids.offerId);
    const unrankedIndex = listedIds.indexOf(unrankedOfferId);

    assert.ok(secondIndex !== -1 && baselineIndex !== -1 && unrankedIndex !== -1);
    assert.ok(secondIndex < baselineIndex, "rank 1 offer should come before rank 2");
    assert.ok(unrankedIndex > baselineIndex, "unranked offer should come after ranked offers");
  });
});

test("storefront offers list orders by root ranks then newest-first fallback", async () => {
  const ids = await getBaselineIds();
  const secondOfferId = await insertOffer(`sf-offer-${Date.now()}`);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const reorderResponse = await request("/api/erp/offers/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ids: [secondOfferId, ids.offerId] })
    });
    assert.equal(reorderResponse.status, 200);

    const unrankedOfferId = await insertOffer(`sf-unranked-offer-${Date.now()}`);

    const response = await request("/api/v1/offers");
    assert.equal(response.status, 200);

    const listedIds = response.json.items.map((item: { id: number }) => item.id);
    assert.deepEqual(
      listedIds.filter((id: number) => [ids.offerId, secondOfferId, unrankedOfferId].includes(id)),
      [secondOfferId, ids.offerId, unrankedOfferId]
    );
  });
});

test("admin collection reorder persists root ordering ranks", async () => {
  const ids = await getBaselineIds();
  const firstCollectionId = await insertCollection(`col-a-${Date.now()}`, ids.leafCategoryId);
  const secondCollectionId = await insertCollection(`col-b-${Date.now()}`, ids.leafCategoryId);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ids: [secondCollectionId, firstCollectionId, ids.collectionId] })
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
        eq(entityOrderings.entityType, "collection")
      )
    );

  const rankByCollectionId = new Map(rows.map((row) => [row.entityId, row.rank]));
  assert.equal(rankByCollectionId.get(secondCollectionId), 1);
  assert.equal(rankByCollectionId.get(firstCollectionId), 2);
});

test("storefront collections list orders by root ranks then newest-first fallback", async () => {
  const ids = await getBaselineIds();
  const firstCollectionId = await insertCollection(`sf-col-a-${Date.now()}`, ids.leafCategoryId);
  const secondCollectionId = await insertCollection(`sf-col-b-${Date.now()}`, ids.leafCategoryId);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const reorderResponse = await request("/api/erp/collections/reorder", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ids: [secondCollectionId, firstCollectionId, ids.collectionId] })
    });
    assert.equal(reorderResponse.status, 200);

    const unrankedCollectionId = await insertCollection(`sf-col-c-${Date.now()}`, ids.leafCategoryId);

    const response = await request("/api/v1/collections");
    assert.equal(response.status, 200);

    const listedIds = response.json.items.map((item: { id: number }) => item.id);
    assert.deepEqual(
      listedIds.filter((id: number) =>
        [firstCollectionId, secondCollectionId, unrankedCollectionId].includes(id)
      ),
      [secondCollectionId, firstCollectionId, unrankedCollectionId]
    );
  });
});

test("offer upsert persists product ordering inside the offer from item order", async () => {
  const ids = await getBaselineIds();
  const slug = `ordered-offer-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "عرض مرتب", en: "Ordered Offer" },
        price: 80,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.secondVariantId, qty: 1 },
          { variantId: ids.firstVariantId, qty: 1 }
        ]
      })
    });
    assert.equal(response.status, 200);
  });

  const [createdOffer] = await db.select({ id: offers.id }).from(offers).where(eq(offers.slug, slug)).limit(1);
  assert.ok(createdOffer);

  const rows = await db
    .select({ entityId: entityOrderings.entityId, rank: entityOrderings.rank })
    .from(entityOrderings)
    .where(
      and(
        eq(entityOrderings.scopeType, "offer"),
        eq(entityOrderings.scopeId, createdOffer.id),
        eq(entityOrderings.entityType, "product")
      )
    );

  const rankByProductId = new Map(rows.map((row) => [row.entityId, row.rank]));
  assert.equal(rankByProductId.get(ids.productTwoId), 1);
  assert.equal(rankByProductId.get(ids.productOneId), 2);
});

test("storefront offer detail returns items following the offer's product order", async () => {
  const ids = await getBaselineIds();
  const slug = `sf-ordered-offer-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "عرض", en: "Offer" },
        price: 80,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ]
      })
    });
    assert.equal(createResponse.status, 200);

    const [createdOffer] = await db.select({ id: offers.id }).from(offers).where(eq(offers.slug, slug)).limit(1);
    assert.ok(createdOffer);

    const updateResponse = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        id: createdOffer.id,
        slug,
        name: { ar: "عرض", en: "Offer" },
        price: 80,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.secondVariantId, qty: 1 },
          { variantId: ids.firstVariantId, qty: 1 }
        ]
      })
    });
    assert.equal(updateResponse.status, 200);

    const response = await request(`/api/v1/offers/${slug}`);
    assert.equal(response.status, 200);

    const variantIds = response.json.items.map((item: { variantId: number }) => item.variantId);
    assert.deepEqual(variantIds, [ids.secondVariantId, ids.firstVariantId]);
  });
});

test("collection upsert persists product ordering inside the collection from item order", async () => {
  const ids = await getBaselineIds();
  const slug = `ordered-collection-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة مرتبة", en: "Ordered Collection" },
        price: 80,
        categoryId: ids.leafCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.secondVariantId, qty: 1 },
          { variantId: ids.firstVariantId, qty: 1 }
        ]
      })
    });
    assert.equal(response.status, 200);
  });

  const [createdCollection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  assert.ok(createdCollection);

  const rows = await db
    .select({ entityId: entityOrderings.entityId, rank: entityOrderings.rank })
    .from(entityOrderings)
    .where(
      and(
        eq(entityOrderings.scopeType, "collection"),
        eq(entityOrderings.scopeId, createdCollection.id),
        eq(entityOrderings.entityType, "product")
      )
    );

  const rankByProductId = new Map(rows.map((row) => [row.entityId, row.rank]));
  assert.equal(rankByProductId.get(ids.productTwoId), 1);
  assert.equal(rankByProductId.get(ids.productOneId), 2);
});

test("storefront collection detail returns items following the collection's product order", async () => {
  const ids = await getBaselineIds();
  const slug = `sf-ordered-collection-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة", en: "Collection" },
        price: 80,
        categoryId: ids.leafCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.secondVariantId, qty: 1 },
          { variantId: ids.firstVariantId, qty: 1 }
        ]
      })
    });
    assert.equal(createResponse.status, 200);

    const response = await request(`/api/v1/collections/${slug}`);
    assert.equal(response.status, 200);

    const variantIds = response.json.items.map((item: { variantId: number }) => item.variantId);
    assert.deepEqual(variantIds, [ids.secondVariantId, ids.firstVariantId]);
  });
});
