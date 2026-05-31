import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { and, asc, eq, or, sql } from "drizzle-orm";
import {
  categories,
  collectionItems,
  collections,
  relatedItems
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
        imagePath: "/uploads/test-collection.png",
        price: 149,
        categoryId: ids.leafCategoryId,
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
    assert.equal(
      adminCollectionsResponse.json.items.some((collection: any) => collection.slug === slug),
      true
    );

    const storefrontCollectionsResponse = await request("/api/v1/collections");
    assert.equal(storefrontCollectionsResponse.status, 200);
    assert.equal(
      storefrontCollectionsResponse.json.items.some((collection: any) => collection.slug === slug),
      true
    );
  });

  const [createdCollection] = await db
    .select({
      id: collections.id,
      slug: collections.slug,
      arName: collections.arName,
      enName: collections.enName,
      visibility: collections.visibility,
      categoryId: collections.categoryId
    })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  assert.ok(createdCollection, "expected collection row to be inserted");
  assert.equal(createdCollection.arName, "مجموعة اختبار");
  assert.equal(createdCollection.enName, "Route Collection Test");
  assert.equal(createdCollection.visibility, "visible");
  assert.equal(createdCollection.categoryId, ids.leafCategoryId);

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
        price: 149,
        categoryId: ids.leafCategoryId,
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

serialTest("admin collection detail returns a related-items array for editing", async () => {
  const ids = await getBaselineIds();

  const [created] = await db
    .insert(collections)
    .values({
      slug: `detail-collection-${Date.now()}`,
      arName: "مجموعة تفاصيل",
      enName: "Detail Collection",
      fixedPrice: sql`120`,
      categoryId: ids.leafCategoryId,
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
