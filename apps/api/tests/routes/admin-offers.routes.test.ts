import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { and, asc, eq, or } from "drizzle-orm";
import { offerItems, offers, products, relatedItems } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

beforeEach(async () => {
  await resetApiTestDatabase();
});

serialTest("admin offer upsert creates a new offer when the payload has no id", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug,
        name: { ar: "عرض اختبار", en: "Route Offer Test" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 199,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 2 }
        ]
      })
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);

    const adminOffersResponse = await request("/api/erp/offers", {
      headers: { ...authHeaders }
    });
    assert.equal(adminOffersResponse.status, 200);
    assert.equal(
      adminOffersResponse.json.items.some((offer: any) => offer.slug === slug),
      true
    );

    const storefrontOffersResponse = await request("/api/v1/offers");
    assert.equal(storefrontOffersResponse.status, 200);
    assert.equal(
      storefrontOffersResponse.json.items.some((offer: any) => offer.slug === slug),
      true
    );
  });

  const [createdOffer] = await db
    .select({
      id: offers.id,
      slug: offers.slug,
      arName: offers.arName,
      enName: offers.enName,
      visibility: offers.visibility
    })
    .from(offers)
    .where(eq(offers.slug, slug))
    .limit(1);

  assert.ok(createdOffer, "expected offer row to be inserted");
  assert.equal(createdOffer.arName, "عرض اختبار");
  assert.equal(createdOffer.enName, "Route Offer Test");
  assert.equal(createdOffer.visibility, "visible");

  const createdItems = await db
    .select({
      variantId: offerItems.variantId,
      qty: offerItems.qty
    })
    .from(offerItems)
    .where(eq(offerItems.offerId, createdOffer.id));

  assert.equal(createdItems.length, 2);
  assert.deepEqual(
    createdItems
      .map((item) => ({ variantId: item.variantId, qty: item.qty }))
      .sort((a, b) => a.variantId - b.variantId),
    [
      { variantId: ids.firstVariantId, qty: 1 },
      { variantId: ids.secondVariantId, qty: 2 }
    ].sort((a, b) => a.variantId - b.variantId)
  );

  await db.delete(offerItems).where(eq(offerItems.offerId, createdOffer.id));
  await db.delete(offers).where(eq(offers.id, createdOffer.id));
});

serialTest("admin offer upsert persists mirrored related links", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-related-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "عرض مرتبط", en: "Related Offer" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 199,
        status: "active",
        visibility: "visible",
        items: [{ variantId: ids.firstVariantId, qty: 1 }],
        relatedItems: [{ type: "product", id: ids.productOneId }]
      })
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);
  });

  const [created] = await db.select({ id: offers.id }).from(offers).where(eq(offers.slug, slug)).limit(1);
  assert.ok(created, "expected created offer to exist");

  const offerLinks = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "offer"), eq(relatedItems.sourceId, created.id)))
    .orderBy(asc(relatedItems.id));
  const productLinks = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, ids.productOneId)))
    .orderBy(asc(relatedItems.id));

  assert.deepEqual(offerLinks, [{ targetType: "product", targetId: ids.productOneId, rank: 1 }]);
  assert.deepEqual(productLinks, [{ targetType: "offer", targetId: created.id, rank: 1 }]);

  await db.delete(relatedItems).where(
    or(
      and(eq(relatedItems.sourceType, "offer"), eq(relatedItems.sourceId, created.id)),
      and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, ids.productOneId))
    )
  );
  await db.delete(offerItems).where(eq(offerItems.offerId, created.id));
  await db.delete(offers).where(eq(offers.id, created.id));
});

serialTest("admin offer detail returns a related-items array for editing", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/offers/${ids.offerId}`, {
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.id, ids.offerId);
    assert.ok(Array.isArray(response.json.relatedItems));
  });
});

serialTest("admin offer upsert preserves existing related links when relatedItems is omitted", async () => {
  const ids = await getBaselineIds();

  await db.insert(relatedItems).values([
    {
      sourceType: "offer",
      sourceId: ids.offerId,
      targetType: "product",
      targetId: ids.productOneId,
      rank: 1
    },
    {
      sourceType: "product",
      sourceId: ids.productOneId,
      targetType: "offer",
      targetId: ids.offerId,
      rank: 1
    }
  ]);

  const before = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "offer"), eq(relatedItems.sourceId, ids.offerId)))
    .orderBy(asc(relatedItems.rank), asc(relatedItems.id));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: ids.offerId,
        slug: `offer-${ids.offerId}`,
        name: { ar: "عرض محدث", en: "Updated Offer" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 199,
        status: "active",
        visibility: "visible",
        items: [{ variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const after = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "offer"), eq(relatedItems.sourceId, ids.offerId)))
    .orderBy(asc(relatedItems.rank), asc(relatedItems.id));

  assert.deepEqual(after, before);
});

serialTest("admin offer upsert updates existing offer items in place when ids are provided", async () => {
  const ids = await getBaselineIds();

  const existingItems = await db
    .select({
      id: offerItems.id,
      variantId: offerItems.variantId,
      qty: offerItems.qty
    })
    .from(offerItems)
    .where(eq(offerItems.offerId, ids.offerId))
    .orderBy(asc(offerItems.id));

  assert.ok(existingItems.length > 0, "expected baseline offer items");

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: ids.offerId,
        slug: "test-offer-baseline",
        name: { ar: "عرض تجريبي", en: "Baseline Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-offer.png",
        price: 88,
        status: "active",
        visibility: "visible",
        items: existingItems.map((item, index) => ({
          id: item.id,
          variantId: item.variantId,
          qty: item.qty + index + 1
        }))
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const updatedItems = await db
    .select({
      id: offerItems.id,
      variantId: offerItems.variantId,
      qty: offerItems.qty
    })
    .from(offerItems)
    .where(eq(offerItems.offerId, ids.offerId))
    .orderBy(asc(offerItems.id));

  assert.deepEqual(
    updatedItems,
    existingItems.map((item, index) => ({
      id: item.id,
      variantId: item.variantId,
      qty: item.qty + index + 1
    }))
  );
});

serialTest("admin offer upsert merges duplicate variant rows before persisting", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-merge-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug,
        name: { ar: "عرض دمج", en: "Merged Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-offer.png",
        price: 88,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.firstVariantId, qty: 2 },
          { variantId: ids.secondVariantId, qty: 3 }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [createdOffer] = await db
    .select({ id: offers.id })
    .from(offers)
    .where(eq(offers.slug, slug))
    .limit(1);

  assert.ok(createdOffer, "expected merged offer to exist");

  const createdItems = await db
    .select({
      variantId: offerItems.variantId,
      qty: offerItems.qty
    })
    .from(offerItems)
    .where(eq(offerItems.offerId, createdOffer.id))
    .orderBy(asc(offerItems.variantId));

  assert.deepEqual(createdItems, [
    { variantId: ids.firstVariantId, qty: 3 },
    { variantId: ids.secondVariantId, qty: 3 }
  ]);
});

serialTest("admin offers list returns ERP offer shape with bilingual name", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 200);
    const offer = response.json.items[0];
    assert.equal(typeof offer.name?.ar, "string");
    assert.equal(typeof offer.name?.en, "string");
    assert.equal(typeof offer.description?.ar, "string");
    assert.equal(typeof offer.description?.en, "string");
    assert.equal(typeof offer.price, "number");
    assert.equal(typeof offer.originalTotal, "number");
    assert.ok(Array.isArray(offer.items));
  });
});

serialTest("admin offer toggle-status flips the persisted DB status", async () => {
  const ids = await getBaselineIds();

  const [before] = await db
    .select({ slug: offers.slug, status: offers.status })
    .from(offers)
    .where(eq(offers.id, ids.offerId))
    .limit(1);

  assert.ok(before, "expected baseline offer to exist");
  assert.equal(before.status, "active");

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const storefrontBefore = await request("/api/v1/offers");
    assert.equal(storefrontBefore.status, 200);
    assert.equal(
      storefrontBefore.json.items.some((offer: any) => offer.id === ids.offerId),
      true
    );

    const response = await request(`/api/erp/offers/${ids.offerId}/toggle-status`, {
      method: "POST",
      headers: {
        ...authHeaders
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const storefrontAfterFirstToggle = await request("/api/v1/offers");
    assert.equal(storefrontAfterFirstToggle.status, 200);
    assert.equal(
      storefrontAfterFirstToggle.json.items.some((offer: any) => offer.id === ids.offerId),
      false
    );

    const offerDetailAfterFirstToggle = await request(`/api/v1/offers/${before.slug}`);
    assert.equal(offerDetailAfterFirstToggle.status, 404);
  });

  const [afterFirstToggle] = await db
    .select({ status: offers.status })
    .from(offers)
    .where(eq(offers.id, ids.offerId))
    .limit(1);

  assert.ok(afterFirstToggle, "expected offer after first toggle");
  assert.equal(afterFirstToggle.status, "inactive");

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/offers/${ids.offerId}/toggle-status`, {
      method: "POST",
      headers: {
        ...authHeaders
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);

    const storefrontAfterSecondToggle = await request("/api/v1/offers");
    assert.equal(storefrontAfterSecondToggle.status, 200);
    assert.equal(
      storefrontAfterSecondToggle.json.items.some((offer: any) => offer.id === ids.offerId),
      true
    );

    const offerDetailAfterSecondToggle = await request(`/api/v1/offers/${before.slug}`);
    assert.equal(offerDetailAfterSecondToggle.status, 200);
  });

  const [afterSecondToggle] = await db
    .select({ status: offers.status })
    .from(offers)
    .where(eq(offers.id, ids.offerId))
    .limit(1);

  assert.ok(afterSecondToggle, "expected offer after second toggle");
  assert.equal(afterSecondToggle.status, "active");
});

serialTest("admin offer revalidation includes related product slugs for bundle members", async () => {
  const ids = await getBaselineIds();
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  const calls: Array<{ input: string; init?: RequestInit }> = [];

  const productRows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(or(eq(products.id, ids.productOneId), eq(products.id, ids.productTwoId)));

  process.env.NODE_ENV = "development";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/revalidate")) {
      calls.push({ input: url, init });
      return new Response(null, { status: 200 });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    await withTestServer(app, async (request) => {
      const authHeaders = await getAdminAuthHeaders(request);
      const response = await request(`/api/erp/offers/${ids.offerId}/toggle-status`, {
        method: "POST",
        headers: { ...authHeaders }
      });

      assert.equal(response.status, 200);
      assert.equal(response.json.ok, true);
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.equal(calls.length, 1);
  const payload = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(payload.entity, "offer");
  assert.equal(payload.slug, "test-offer-baseline");
  assert.deepEqual([...payload.relatedProductSlugs].sort(), productRows.map((row) => row.slug).sort());
});
