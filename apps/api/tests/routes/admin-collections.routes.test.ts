import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, asc, eq, or, sql } from "drizzle-orm";
import {
  categories,
  collectionItems,
  collections,
  entityMedia,
  entityOrderings,
  orderItems,
  orders,
  products,
  relatedItems,
  wishlists
} from "@capella/database/drizzle/schema";
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

serialTest("admin collection upsert creates a new collection when the payload has no id", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/collections", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة اختبار", en: "Route Collection Test" },
        description: { ar: "وصف", en: "Description" },
        youtubeUrl: "https://www.youtube.com/watch?v=route-collection",
        imagePath: "/uploads/test-collection.png",
        media: [
          { type: "image", url: "/uploads/test-collection.png" },
          { type: "image", url: "/uploads/test-collection-detail.png" },
          { type: "video", url: "/uploads/test-collection-demo.mp4" }
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

    const adminCollectionsResponse = await request("/api/erp/collections", {
      headers: { ...authHeaders }
    });
    assert.equal(adminCollectionsResponse.status, 200);
    const adminCollection = adminCollectionsResponse.json.items.find((collection: any) => collection.slug === slug);
    assert.equal(adminCollection.youtubeUrl, "https://www.youtube.com/watch?v=route-collection");
    assert.deepEqual(adminCollection.media, [
      { type: "image", arUrl: null, enUrl: "http://localhost:4000/uploads/test-collection.png" },
      { type: "image", arUrl: null, enUrl: "http://localhost:4000/uploads/test-collection-detail.png" },
      { type: "video", url: "http://localhost:4000/uploads/test-collection-demo.mp4" }
    ]);

    const storefrontCollectionsResponse = await request("/api/v1/collections");
    assert.equal(storefrontCollectionsResponse.status, 200);
    const storefrontCollection = storefrontCollectionsResponse.json.items.find((collection: any) => collection.slug === slug);
    assert.equal(storefrontCollection.youtubeUrl, adminCollection.youtubeUrl);
    assert.deepEqual(storefrontCollection.media, adminCollection.media);
  });

  const [createdCollection] = await db
    .select({
      id: collections.id,
      slug: collections.slug,
      arName: collections.arName,
      enName: collections.enName,
      youtubeUrl: collections.youtubeUrl,
      visibility: collections.visibility,
      categoryId: collections.categoryId
    })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  assert.ok(createdCollection, "expected collection row to be inserted");
  assert.equal(createdCollection.arName, "مجموعة اختبار");
  assert.equal(createdCollection.enName, "Route Collection Test");
  assert.equal(createdCollection.youtubeUrl, "https://www.youtube.com/watch?v=route-collection");
  assert.equal(createdCollection.visibility, "visible");
  assert.equal(createdCollection.categoryId, ids.rootCategoryId);

  const createdItems = await db
    .select({
      variantId: collectionItems.variantId,
      qty: collectionItems.qty
    })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, createdCollection.id));

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
});

serialTest("admin collection upsert rejects a price at or above the sum of its parts", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-too-pricey-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);

    // Parts total 35 + 55 = 90; pricing the collection at 90 saves nothing.
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة غالية", en: "Too Pricey Collection" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-collection.png",
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

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "price-not-below-original");
  });

  const leaked = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug));
  assert.equal(leaked.length, 0);
});

serialTest("admin collection upsert rejects non-numeric prices", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `route-collection-invalid-price-${Date.now()}`,
        name: { ar: "مجموعة سعر غير صالح", en: "Invalid Price Collection" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/test-collection.png",
        price: "not-a-number",
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [{ variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-fixed-price");
  });
});

serialTest("admin collection upsert persists mirrored related links", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-related-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة مرتبطة", en: "Related Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
        price: 80,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ],
        relatedItems: [{ type: "product", id: ids.productOneId }]
      })
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);
  });

  const [created] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).limit(1);
  assert.ok(created, "expected created collection to exist");

  const collectionLinks = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "collection"), eq(relatedItems.sourceId, created.id)))
    .orderBy(asc(relatedItems.id));
  const productLinks = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, ids.productOneId)))
    .orderBy(asc(relatedItems.id));

  assert.deepEqual(collectionLinks, [{ targetType: "product", targetId: ids.productOneId, rank: 1 }]);
  assert.deepEqual(productLinks, [{ targetType: "collection", targetId: created.id, rank: 1 }]);
});

serialTest("admin collection upsert rejects variants outside the selected category", async () => {
  const ids = await getBaselineIds();

  const [hairCategory] = await db
    .insert(categories)
    .values({
      slug: `hair-care-${Date.now()}`,
      arName: "العناية بالشعر",
      enName: "Hair Care",
      isLeaf: true
    })
    .$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug: `route-collection-invalid-${Date.now()}`,
        name: { ar: "مجموعة خاطئة", en: "Invalid Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
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
    assert.equal(response.json.reason, "collection-item-category-mismatch");
  });
});

serialTest("admin collection upsert accepts variants from descendant categories when the selected category is a parent", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug: `route-collection-parent-${Date.now()}`,
        name: { ar: "مجموعة قسم أب", en: "Parent Category Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
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

serialTest("admin collection upsert rejects non-root categories", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug: `route-collection-leaf-${Date.now()}`,
        name: { ar: "مجموعة قسم فرعي", en: "Leaf Category Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
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
    assert.equal(response.json.reason, "collection-category-must-be-root");
  });
});

serialTest("admin collection detail returns a related-items array for editing", async () => {
  const ids = await getBaselineIds();

  const [created] = await db
    .insert(collections)
    .values({
      slug: `detail-collection-${Date.now()}`,
      arName: "مجموعة تفاصيل",
      enName: "Detail Collection",
      fixedPrice: sql`120`,
      categoryId: ids.rootCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();

  await db.insert(collectionItems).values([
    { collectionId: created.id, variantId: ids.firstVariantId, qty: 1 },
    { collectionId: created.id, variantId: ids.secondVariantId, qty: 1 }
  ]);

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/collections/${created.id}`, {
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.id, created.id);
    assert.ok(Array.isArray(response.json.relatedItems));
  });
});

serialTest("admin collection permanent delete removes a trashed collection and its dependent data", async () => {
  const ids = await getBaselineIds();
  const uploadsDir = resolve(process.cwd(), "uploads");
  const fileName = `test-hard-delete-collection-${ids.collectionId}.jpg`;
  const absolutePath = resolve(uploadsDir, fileName);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(absolutePath, "fake-collection-image-bytes");

  await db.update(collections).set({ deletedAt: new Date() }).where(eq(collections.id, ids.collectionId));
  await db.insert(entityMedia).values({
    collectionId: ids.collectionId,
    mediaType: "image",
    url: `http://localhost:4000/uploads/${fileName}`,
    sortOrder: 1
  });
  await db.insert(wishlists).values({ customerId: ids.customerId, entityType: "collection", entityId: ids.collectionId });
  await db.insert(relatedItems).values({
    sourceType: "product",
    sourceId: ids.productOneId,
    targetType: "collection",
    targetId: ids.collectionId,
    rank: 0
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/collections/${ids.collectionId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 204);
  });

  assert.equal((await db.select().from(collections).where(eq(collections.id, ids.collectionId))).length, 0);
  assert.equal((await db.select().from(collectionItems).where(eq(collectionItems.collectionId, ids.collectionId))).length, 0);
  assert.equal((await db.select().from(wishlists).where(and(eq(wishlists.entityType, "collection"), eq(wishlists.entityId, ids.collectionId)))).length, 0);
  assert.equal((await db.select().from(relatedItems).where(or(
    and(eq(relatedItems.sourceType, "collection"), eq(relatedItems.sourceId, ids.collectionId)),
    and(eq(relatedItems.targetType, "collection"), eq(relatedItems.targetId, ids.collectionId))
  ))).length, 0);
  assert.equal((await db.select().from(entityOrderings).where(or(
    and(eq(entityOrderings.entityType, "collection"), eq(entityOrderings.entityId, ids.collectionId)),
    and(eq(entityOrderings.scopeType, "collection"), eq(entityOrderings.scopeId, ids.collectionId))
  ))).length, 0);
  await assert.rejects(access(absolutePath), "expected collection media file to be unlinked");
});

serialTest("admin collection permanent delete rejects collections referenced by orders", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: `COL-HARD-${Date.now()}`,
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
    totalAmount: "65.00"
  }).$returningId();
  await db.insert(orderItems).values({
    orderId: order.id,
    itemType: "collection",
    collectionId: ids.collectionId,
    qty: 1,
    unitPrice: "65.00",
    lineTotal: "65.00"
  });
  await db.update(collections).set({ deletedAt: new Date() }).where(eq(collections.id, ids.collectionId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/collections/${ids.collectionId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "linked-to-orders");
  });

  const [persistedCollection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, ids.collectionId));
  const [persistedOrderItem] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), eq(orderItems.collectionId, ids.collectionId)));
  assert.ok(persistedCollection, "expected the referenced collection to remain");
  assert.ok(persistedOrderItem, "expected the collection order item to remain");
});

serialTest("admin collection permanent delete returns not-in-trash for active collections", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/collections/${ids.collectionId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 404);
    assert.equal(response.json.reason, "not-in-trash");
  });
});

serialTest("admin collection upsert preserves an existing media gallery when media is omitted", async () => {
  const ids = await getBaselineIds();
  const existingMedia = [
    { collectionId: ids.collectionId, mediaType: "image" as const, url: "/uploads/existing-collection.jpg", sortOrder: 1 },
    { collectionId: ids.collectionId, mediaType: "video" as const, url: "/uploads/existing-collection.mp4", sortOrder: 2 }
  ];
  await db.delete(entityMedia).where(eq(entityMedia.collectionId, ids.collectionId));
  await db.insert(entityMedia).values(existingMedia);
  await db.update(collections).set({ imagePath: existingMedia[0].url }).where(eq(collections.id, ids.collectionId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        id: ids.collectionId,
        slug: "test-collection-baseline",
        name: { ar: "مجموعة محدثة", en: "Updated Collection" },
        description: { ar: "", en: "Updated" },
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
  });

  const rows = await db
    .select({ mediaType: entityMedia.mediaType, url: entityMedia.url, sortOrder: entityMedia.sortOrder })
    .from(entityMedia)
    .where(eq(entityMedia.collectionId, ids.collectionId))
    .orderBy(asc(entityMedia.sortOrder));
  const [collection] = await db
    .select({ imagePath: collections.imagePath })
    .from(collections)
    .where(eq(collections.id, ids.collectionId));

  assert.deepEqual(rows, existingMedia.map(({ mediaType, url, sortOrder }) => ({ mediaType, url, sortOrder })));
  assert.equal(collection?.imagePath, existingMedia[0].url);
});

serialTest("admin collection revalidation includes related product slugs for collection members", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-webhook-${Date.now()}`;
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  const calls: Array<{ input: string; init?: RequestInit }> = [];

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
      const createResponse = await request("/api/erp/collections", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          slug,
          name: { ar: "مجموعة ويب هوك", en: "Webhook Collection" },
          description: { ar: "وصف", en: "Description" },
          imagePath: "/uploads/test-collection.png",
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

      assert.equal(createResponse.status, 200);
      assert.equal(createResponse.json.ok, true);
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }

  const productRows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(and(eq(products.categoryId, ids.leafCategoryId), sql`${products.slug} in ('test-product-baseline-1', 'test-product-baseline-2')`));

  assert.equal(calls.length, 1);
  const payload = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(payload.entity, "collection");
  assert.equal(payload.slug, slug);
  assert.deepEqual([...payload.relatedProductSlugs].sort(), productRows.map((row) => row.slug).sort());
});

serialTest("admin collection upsert persists a dedicated hover image per language", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-hover-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/collections", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة hover", en: "Hover Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
        media: [{ type: "image", url: "/uploads/test-collection.png" }],
        price: 120,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 2 }
        ],
        arHoverImagePath: "/uploads/route-collection-hover-ar.jpg",
        enHoverImagePath: "/uploads/route-collection-hover-en.jpg"
      })
    });

    assert.equal(createResponse.status, 200);
    assert.equal(createResponse.json.ok, true);

    const adminCollectionsResponse = await request("/api/erp/collections", {
      headers: { ...authHeaders }
    });
    const adminCollection = adminCollectionsResponse.json.items.find((collection: any) => collection.slug === slug);
    assert.equal(adminCollection.hoverImagePath, "http://localhost:4000/uploads/route-collection-hover-en.jpg");
    assert.equal(adminCollection.arHoverImagePath, "http://localhost:4000/uploads/route-collection-hover-ar.jpg");
    assert.equal(adminCollection.enHoverImagePath, "http://localhost:4000/uploads/route-collection-hover-en.jpg");

    const storefrontCollectionsResponse = await request("/api/v1/collections");
    const storefrontCollection = storefrontCollectionsResponse.json.items.find((collection: any) => collection.slug === slug);
    assert.equal(storefrontCollection.hoverImagePath, "http://localhost:4000/uploads/route-collection-hover-ar.jpg");
  });

  const [created] = await db
    .select({
      hoverImagePath: collections.hoverImagePath,
      arHoverImagePath: collections.arHoverImagePath
    })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  assert.deepEqual(created, {
    hoverImagePath: "/uploads/route-collection-hover-en.jpg",
    arHoverImagePath: "/uploads/route-collection-hover-ar.jpg"
  });
});

serialTest("admin collection upsert preserves an explicitly missing English hover image", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-hover-ar-only-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/collections", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة hover عربية", en: "Arabic Hover Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
        media: [{ type: "image", url: "/uploads/test-collection.png" }],
        price: 120,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 2 }
        ],
        hoverImagePath: "/uploads/route-collection-hover-ar-only.jpg",
        arHoverImagePath: "/uploads/route-collection-hover-ar-only.jpg",
        enHoverImagePath: null
      })
    });

    assert.equal(createResponse.status, 200);
  });

  const [created] = await db
    .select({
      hoverImagePath: collections.hoverImagePath,
      arHoverImagePath: collections.arHoverImagePath
    })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  assert.deepEqual(created, {
    hoverImagePath: null,
    arHoverImagePath: "/uploads/route-collection-hover-ar-only.jpg"
  });
});

serialTest("admin collection update omitting hover fields preserves stored hover images", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-hover-keep-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const base = {
      slug,
      name: { ar: "مجموعة hover", en: "Hover Collection" },
      description: { ar: "وصف", en: "Description" },
      imagePath: "/uploads/test-collection.png",
      media: [{ type: "image", url: "/uploads/test-collection.png" }],
      price: 120,
      categoryId: ids.rootCategoryId,
      status: "active",
      visibility: "visible",
      items: [
        { variantId: ids.firstVariantId, qty: 1 },
        { variantId: ids.secondVariantId, qty: 2 }
      ],
      arHoverImagePath: "/uploads/route-collection-hover-keep-ar.jpg",
      enHoverImagePath: "/uploads/route-collection-hover-keep-en.jpg"
    };

    const created = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify(base)
    });
    assert.equal(created.status, 200);

    const [row] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).limit(1);
    const { arHoverImagePath: _ar, enHoverImagePath: _en, ...withoutHover } = base;
    const updated = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ...withoutHover, id: row!.id })
    });
    assert.equal(updated.status, 200);
  });

  const [after] = await db
    .select({ hoverImagePath: collections.hoverImagePath, arHoverImagePath: collections.arHoverImagePath })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  assert.deepEqual(after, {
    hoverImagePath: "/uploads/route-collection-hover-keep-en.jpg",
    arHoverImagePath: "/uploads/route-collection-hover-keep-ar.jpg"
  });
});

serialTest("admin collection update omitting visibility preserves the stored visibility", async () => {
  const ids = await getBaselineIds();
  const slug = `route-collection-hidden-keep-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const created = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug,
        name: { ar: "مجموعة مخفية", en: "Hidden Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
        media: [{ type: "image", url: "/uploads/test-collection.png" }],
        price: 1,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "hidden",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ],
        arHoverImagePath: "/uploads/route-collection-hidden-ar.jpg",
        enHoverImagePath: "/uploads/route-collection-hidden-en.jpg"
      })
    });
    assert.equal(created.status, 200);

    const [row] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slug)).limit(1);
    const updated = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        id: row!.id,
        slug,
        name: { ar: "مجموعة مخفية", en: "Hidden Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
        media: [{ type: "image", url: "/uploads/test-collection.png" }],
        price: 1,
        categoryId: ids.rootCategoryId,
        status: "active",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 1 }
        ],
        arHoverImagePath: "/uploads/route-collection-hidden-ar-2.jpg"
      })
    });
    assert.equal(updated.status, 200);
  });

  const [after] = await db
    .select({ visibility: collections.visibility, arHoverImagePath: collections.arHoverImagePath })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  assert.equal(after?.visibility, "hidden");
  assert.equal(after?.arHoverImagePath, "/uploads/route-collection-hidden-ar-2.jpg");
});

serialTest("admin collection upsert rejects non-string hover image values", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/collections", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        slug: `route-collection-hover-invalid-${Date.now()}`,
        name: { ar: "مجموعة hover", en: "Hover Collection" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/test-collection.png",
        media: [{ type: "image", url: "/uploads/test-collection.png" }],
        price: 120,
        categoryId: ids.rootCategoryId,
        status: "active",
        visibility: "visible",
        items: [
          { variantId: ids.firstVariantId, qty: 1 },
          { variantId: ids.secondVariantId, qty: 2 }
        ],
        arHoverImagePath: { url: "/uploads/x.jpg" }
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-hover-image");
  });

  const rows = await db
    .select({ id: collections.id })
    .from(collections)
    .where(sql`${collections.slug} like 'route-collection-hover-invalid-%'`);
  assert.equal(rows.length, 0, "expected no collection to be created from an invalid hover payload");
});

serialTest("admin collection permanent delete keeps a hover file still referenced by another collection", async () => {
  const ids = await getBaselineIds();
  const uploadsDir = resolve(process.cwd(), "uploads");
  const sharedFileName = `test-shared-collection-hover-${ids.collectionId}.jpg`;
  const sharedAbsolutePath = resolve(uploadsDir, sharedFileName);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(sharedAbsolutePath, "fake-shared-hover-bytes");
  const sharedUrl = `/uploads/${sharedFileName}`;

  const orphanFileName = `test-orphan-collection-hover-${ids.collectionId}.jpg`;
  const orphanAbsolutePath = resolve(uploadsDir, orphanFileName);
  await writeFile(orphanAbsolutePath, "fake-orphan-hover-bytes");
  const orphanUrl = `/uploads/${orphanFileName}`;

  const slugKept = `route-collection-hover-kept-${Date.now()}`;
  const slugDeleted = `route-collection-hover-deleted-${Date.now()}`;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const base = {
      name: { ar: "مجموعة hover", en: "Hover Collection" },
      description: { ar: "وصف", en: "Description" },
      imagePath: "/uploads/test-collection.png",
      media: [{ type: "image", url: "/uploads/test-collection.png" }],
      price: 120,
      categoryId: ids.rootCategoryId,
      status: "active",
      visibility: "visible",
      items: [
        { variantId: ids.firstVariantId, qty: 1 },
        { variantId: ids.secondVariantId, qty: 2 }
      ]
    };

    // The deleted collection shares the kept collection's Arabic hover file, so deletion
    // must actually evaluate the new hover reference checks, plus an exclusively-owned file.
    for (const [slug, arHover, enHover] of [
      [slugKept, sharedUrl, sharedUrl],
      [slugDeleted, sharedUrl, orphanUrl]
    ] as const) {
      const created = await request("/api/erp/collections", {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ ...base, slug, arHoverImagePath: arHover, enHoverImagePath: enHover })
      });
      assert.equal(created.status, 200);
    }
  });

  await db.update(collections).set({ deletedAt: new Date() }).where(eq(collections.slug, slugDeleted));
  const [deletedRow] = await db.select({ id: collections.id }).from(collections).where(eq(collections.slug, slugDeleted)).limit(1);
  assert.ok(deletedRow, "expected the deleted collection to exist");

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/collections/${deletedRow.id}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 204);
  });

  // The orphan file has no remaining references and must be unlinked; the shared file is still the kept collection's hover image, so the reference check must protect it from the deleted collection's cleanup.
  await assert.rejects(access(orphanAbsolutePath), "expected the orphaned hover file to be unlinked");
  await assert.doesNotReject(access(sharedAbsolutePath), "expected the shared hover file to survive");
});
