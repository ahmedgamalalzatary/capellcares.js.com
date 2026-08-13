import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, asc, eq, or } from "drizzle-orm";
import { categories, entityMedia, entityOrderings, offerItems, offers, orderItems, orders, products, relatedItems, wishlists } from "@capella/database/drizzle/schema";
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
        youtubeUrl: "https://www.youtube.com/watch?v=route-offer",
        imagePath: "/uploads/test-offer.png",
        media: [
          { type: "image", url: "/uploads/test-offer.png" },
          { type: "image", url: "/uploads/test-offer-detail.png" },
          { type: "video", url: "/uploads/test-offer-demo.mp4" }
        ],
        price: 120,
        categoryId: ids.rootCategoryId,
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
    const adminOffer = adminOffersResponse.json.items.find((offer: any) => offer.slug === slug);
    assert.equal(adminOffer.youtubeUrl, "https://www.youtube.com/watch?v=route-offer");
    assert.deepEqual(adminOffer.media, [
      { type: "image", arUrl: null, enUrl: "http://localhost:4000/uploads/test-offer.png" },
      { type: "image", arUrl: null, enUrl: "http://localhost:4000/uploads/test-offer-detail.png" },
      { type: "video", url: "http://localhost:4000/uploads/test-offer-demo.mp4" }
    ]);

    const storefrontOffersResponse = await request("/api/v1/offers");
    assert.equal(storefrontOffersResponse.status, 200);
    const storefrontOffer = storefrontOffersResponse.json.items.find((offer: any) => offer.slug === slug);
    assert.equal(storefrontOffer.youtubeUrl, adminOffer.youtubeUrl);
    assert.deepEqual(storefrontOffer.media, adminOffer.media);
  });

  const [createdOffer] = await db
    .select({
      id: offers.id,
      slug: offers.slug,
      arName: offers.arName,
      enName: offers.enName,
      youtubeUrl: offers.youtubeUrl,
      visibility: offers.visibility
    })
    .from(offers)
    .where(eq(offers.slug, slug))
    .limit(1);

  assert.ok(createdOffer, "expected offer row to be inserted");
  assert.equal(createdOffer.arName, "عرض اختبار");
  assert.equal(createdOffer.enName, "Route Offer Test");
  assert.equal(createdOffer.youtubeUrl, "https://www.youtube.com/watch?v=route-offer");
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

serialTest("admin offer upsert rejects a price at or above the sum of its parts", async () => {
  const ids = await getBaselineIds();
  const equalToPartsSlug = `route-offer-too-pricey-${Date.now()}`;
  const aboveSingleVariantSlug = `route-offer-above-single-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    // Bundle parts total 35 + 55 = 90; a 90 price saves the customer nothing.
    const equalToParts = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: equalToPartsSlug,
        name: { ar: "عرض غالي", en: "Too Pricey Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-offer.png",
        price: 90,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ]
      })
    });

    assert.equal(equalToParts.status, 400);
    assert.equal(equalToParts.json.reason, "price-not-below-original");

    // Single-variant offer: the lone variant costs 35, so 40 is more expensive.
    const aboveSingleVariant = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: aboveSingleVariantSlug,
        name: { ar: "عرض متغير غالي", en: "Above Single Variant" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-offer.png",
        price: 40,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [{ variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(aboveSingleVariant.status, 400);
    assert.equal(aboveSingleVariant.json.reason, "price-not-below-original");
  });

  const leakedOffers = await db
    .select({ id: offers.id })
    .from(offers)
    .where(or(eq(offers.slug, equalToPartsSlug), eq(offers.slug, aboveSingleVariantSlug)));
  assert.equal(leakedOffers.length, 0);
});

serialTest("admin offer upsert rejects non-numeric prices", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `route-offer-invalid-price-${Date.now()}`,
        name: { ar: "عرض سعر غير صالح", en: "Invalid Price Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-offer.png",
        price: "not-a-number",
        status: "active",
        visibility: "visible",
        items: [{ variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-fixed-price");
  });
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
        price: 30,
        categoryId: ids.rootCategoryId,
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
        price: 30,
        categoryId: ids.rootCategoryId,
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

serialTest("admin offer upsert preserves an existing media gallery when media is omitted", async () => {
  const ids = await getBaselineIds();
  const existingMedia = [
    { offerId: ids.offerId, mediaType: "image" as const, url: "/uploads/existing-offer.jpg", sortOrder: 1 },
    { offerId: ids.offerId, mediaType: "video" as const, url: "/uploads/existing-offer.mp4", sortOrder: 2 }
  ];
  await db.delete(entityMedia).where(eq(entityMedia.offerId, ids.offerId));
  await db.insert(entityMedia).values(existingMedia);
  await db.update(offers).set({ imagePath: existingMedia[0].url }).where(eq(offers.id, ids.offerId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        id: ids.offerId,
        slug: "test-offer-baseline",
        name: { ar: "عرض محدث", en: "Updated Offer" },
        description: { ar: "", en: "Updated" },
        price: 30,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [{ variantId: ids.firstVariantId, qty: 1 }]
      })
    });
    assert.equal(response.status, 200);
  });

  const rows = await db
    .select({ mediaType: entityMedia.mediaType, url: entityMedia.url, sortOrder: entityMedia.sortOrder })
    .from(entityMedia)
    .where(eq(entityMedia.offerId, ids.offerId))
    .orderBy(asc(entityMedia.sortOrder));
  const [offer] = await db.select({ imagePath: offers.imagePath }).from(offers).where(eq(offers.id, ids.offerId));

  assert.deepEqual(rows, existingMedia.map(({ mediaType, url, sortOrder }) => ({ mediaType, url, sortOrder })));
  assert.equal(offer?.imagePath, existingMedia[0].url);
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
        categoryId: ids.rootCategoryId,
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
        categoryId: ids.rootCategoryId,
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

serialTest("admin offer permanent delete removes a soft-deleted offer and its items", async () => {
  const ids = await getBaselineIds();
  const uploadsDir = resolve(process.cwd(), "uploads");
  const fileName = `test-hard-delete-offer-${ids.offerId}.jpg`;
  const absolutePath = resolve(uploadsDir, fileName);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(absolutePath, "fake-offer-image-bytes");

  await db.update(offers).set({ deletedAt: new Date() }).where(eq(offers.id, ids.offerId));
  await db.insert(entityMedia).values({
    offerId: ids.offerId,
    mediaType: "image",
    url: `http://localhost:4000/uploads/${fileName}`,
    sortOrder: 1
  });
  await db.insert(wishlists).values({ customerId: ids.customerId, entityType: "offer", entityId: ids.offerId });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/offers/${ids.offerId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 204);
  });

  const remainingOffers = await db
    .select({ id: offers.id })
    .from(offers)
    .where(eq(offers.id, ids.offerId));
  assert.equal(remainingOffers.length, 0);

  const remainingItems = await db
    .select({ id: offerItems.id })
    .from(offerItems)
    .where(eq(offerItems.offerId, ids.offerId));
  assert.equal(remainingItems.length, 0);

  const remainingRelatedItems = await db
    .select({ id: relatedItems.id })
    .from(relatedItems)
    .where(
      or(
        and(eq(relatedItems.sourceType, "offer"), eq(relatedItems.sourceId, ids.offerId)),
        and(eq(relatedItems.targetType, "offer"), eq(relatedItems.targetId, ids.offerId))
      )
    );
  assert.equal(remainingRelatedItems.length, 0);

  const remainingEntityOrderings = await db
    .select({ id: entityOrderings.id })
    .from(entityOrderings)
    .where(
      or(
        and(eq(entityOrderings.entityType, "offer"), eq(entityOrderings.entityId, ids.offerId)),
        and(eq(entityOrderings.scopeType, "offer"), eq(entityOrderings.scopeId, ids.offerId))
      )
    );
  assert.equal(remainingEntityOrderings.length, 0);
  const remainingWishlists = await db
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(and(eq(wishlists.entityType, "offer"), eq(wishlists.entityId, ids.offerId)));
  assert.equal(remainingWishlists.length, 0);
  await assert.rejects(access(absolutePath), "expected offer media file to be unlinked");
});

serialTest("admin offer permanent delete rejects offers referenced by orders", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: `OFF-HARD-${Date.now()}`,
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    paymentMethod: "cod",
    paymentStatus: "accepted",
    totalAmount: "75.00"
  }).$returningId();
  await db.insert(orderItems).values({
    orderId: order.id,
    itemType: "offer",
    offerId: ids.offerId,
    qty: 1,
    unitPrice: "75.00",
    lineTotal: "75.00"
  });
  await db.update(offers).set({ deletedAt: new Date() }).where(eq(offers.id, ids.offerId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/offers/${ids.offerId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "linked-to-orders");
  });
});

serialTest("admin offer permanent delete returns not-in-trash for active offers", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/offers/${ids.offerId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 404);
    assert.equal(response.json.reason, "not-in-trash");
  });
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

serialTest("admin offer upsert persists the selected root category", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-category-${Date.now()}`;

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
        name: { ar: "عرض بقسم", en: "Categorised Offer" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 80,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [created] = await db.select({ categoryId: offers.categoryId }).from(offers).where(eq(offers.slug, slug)).limit(1);
  assert.equal(created?.categoryId, ids.rootCategoryId);
});

serialTest("admin offer upsert rejects non-root categories", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug: `route-offer-leaf-${Date.now()}`,
        name: { ar: "عرض قسم فرعي", en: "Leaf Category Offer" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 80,
        categoryId: ids.leafCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "offer-category-must-be-root");
  });
});

serialTest("admin offer upsert rejects variants outside the selected category", async () => {
  const ids = await getBaselineIds();

  const [hairCategory] = await db
    .insert(categories)
    .values({
      slug: `offer-hair-care-${Date.now()}`,
      arName: "العناية بالشعر",
      enName: "Hair Care",
      isLeaf: true
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug: `route-offer-invalid-${Date.now()}`,
        name: { ar: "عرض خاطئ", en: "Invalid Offer" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 149,
        categoryId: hairCategory.id,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "offer-item-category-mismatch");
  });
});

serialTest("admin offer upsert accepts variants from descendant categories when the selected category is a parent", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug: `route-offer-parent-${Date.now()}`,
        name: { ar: "عرض قسم أب", en: "Parent Category Offer" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 80,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });
});

serialTest("admin offer upsert persists an explicitly hidden offer as hidden", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-hidden-${Date.now()}`;

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
        name: { ar: "عرض مخفي", en: "Hidden Offer" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-offer.png",
        price: 80,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "hidden",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ]
      })
    });

    assert.equal(response.status, 200);

    const listResponse = await request("/api/erp/offers", { headers: { ...authHeaders } });
    const created = listResponse.json.items.find((item: { slug: string }) => item.slug === slug);
    assert.equal(created.visibility, "hidden");
    assert.equal(created.categoryId, ids.rootCategoryId);
  });
});

serialTest("admin offer toggle-status refuses to activate an uncategorised offer", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-legacy-toggle-${Date.now()}`;

  // A legacy row: no category, parked inactive by the classification migration.
  const [legacy] = await db
    .insert(offers)
    .values({
      slug,
      arName: "عرض قديم",
      enName: "Legacy Offer",
      fixedPrice: "50.00",
      categoryId: null,
      status: "inactive",
      visibility: "visible"
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/offers/${legacy.id}/toggle-status`, {
      method: "POST",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "offer-category-required");
  });

  const [row] = await db.select({ status: offers.status }).from(offers).where(eq(offers.id, legacy.id)).limit(1);
  assert.equal(row?.status, "inactive");

  await db.delete(offers).where(eq(offers.id, legacy.id));
  assert.ok(ids.rootCategoryId);
});

serialTest("admin offer restore keeps an uncategorised offer inactive", async () => {
  const slug = `route-offer-legacy-restore-${Date.now()}`;

  const [legacy] = await db
    .insert(offers)
    .values({
      slug,
      arName: "عرض قديم محذوف",
      enName: "Legacy Trashed Offer",
      fixedPrice: "50.00",
      categoryId: null,
      status: "active",
      visibility: "visible",
      deletedAt: new Date("2026-01-01T00:00:00Z")
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/offers/${legacy.id}/restore`, {
      method: "POST",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 200);
  });

  const [row] = await db
    .select({ status: offers.status, deletedAt: offers.deletedAt })
    .from(offers)
    .where(eq(offers.id, legacy.id))
    .limit(1);

  assert.equal(row?.deletedAt, null);
  assert.equal(row?.status, "inactive", "an uncategorised offer must not come back live");

  await db.delete(offers).where(eq(offers.id, legacy.id));
});

serialTest("admin offer upsert rejects an offer with no items", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `route-offer-empty-${Date.now()}`,
        name: { ar: "عرض فارغ", en: "Empty Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-offer.png",
        price: 999,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: []
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "offer-min-one-variant");
  });
});

serialTest("admin offer upsert keeps a hidden offer hidden when visibility is omitted", async () => {
  const ids = await getBaselineIds();
  const slug = `route-offer-keep-hidden-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const basePayload = {
      slug,
      name: { ar: "عرض مخفي", en: "Hidden Offer" },
      description: { ar: "وصف", en: "Description" },
      imagePath: "/uploads/test-offer.png",
      price: 80,
      categoryId: ids.rootCategoryId,
      status: "active",
      items: [
        { variantId: ids.firstVariantId, qty: 1 },
        { variantId: ids.secondVariantId, qty: 1 }
      ]
    };

    const created = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ...basePayload, visibility: "hidden" })
    });
    assert.equal(created.status, 200);

    const [row] = await db.select({ id: offers.id }).from(offers).where(eq(offers.slug, slug)).limit(1);

    // Re-save the same offer without a visibility field, as a partial edit would.
    const updated = await request("/api/erp/offers", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ...basePayload, id: row!.id })
    });
    assert.equal(updated.status, 200);
  });

  const [after] = await db.select({ visibility: offers.visibility }).from(offers).where(eq(offers.slug, slug)).limit(1);
  assert.equal(after?.visibility, "hidden", "omitting visibility must not silently republish a hidden offer");
});
