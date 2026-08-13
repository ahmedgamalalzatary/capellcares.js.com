import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { mkdir, writeFile, access, unlink } from "node:fs/promises";
import { resolve } from "node:path";

import { and, asc, eq, or } from "drizzle-orm";
import {
  categories,
  collectionItems,
  offerItems,
  entityMedia,
  products,
  productVariants,
  relatedItems,
  variantDiscounts,
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

function makeCompleteProduct(categoryId: number) {
  return {
    sku: "ROUTE-ACTIVE-COMPLETE",
    name: { ar: "كامل", en: "Complete Product" },
    description: { ar: "وصف", en: "Description" },
    keywords: ["skincare", "body"],
    imagePath: "/uploads/test.jpg",
    status: "active" as const,
    categoryId,
    variants: [{ size: "100ml", price: 250, stock: 10 }]
  };
}

serialTest("admin product upsert rejects activating a product with no variants", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sku: "ROUTE-NO-VARIANTS",
        name: { ar: "بدون variants", en: "No Variants" },
        keywords: ["test"],
        imagePath: "/uploads/test.jpg",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: []
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "cannot-activate-incomplete-product");
  });
});

serialTest("admin product upsert rejects activating a product with no keywords", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sku: "ROUTE-NO-KEYWORDS",
        name: { ar: "بدون كلمات", en: "No Keywords" },
        keywords: [],
        imagePath: "/uploads/test.jpg",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [{ size: "100ml", price: 250, stock: 10 }]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "cannot-activate-incomplete-product");
  });
});

serialTest("admin product upsert rejects activating a product with no image", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sku: "ROUTE-NO-IMAGE",
        name: { ar: "بدون صورة", en: "No Image" },
        keywords: ["test"],
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [{ size: "100ml", price: 250, stock: 10 }]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "cannot-activate-incomplete-product");
  });
});

serialTest("admin product upsert derives an active product image from normalized media", async () => {
  const ids = await getBaselineIds();
  const payload = makeCompleteProduct(ids.leafCategoryId);
  delete (payload as { imagePath?: string }).imagePath;

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        sku: "ROUTE-ACTIVE-MEDIA-IMAGE",
        media: [{ type: "image", url: "/uploads/from-media.jpg" }]
      })
    });
    assert.equal(response.status, 200);
  });

  const [created] = await db
    .select({ imagePath: products.imagePath })
    .from(products)
    .where(eq(products.sku, "ROUTE-ACTIVE-MEDIA-IMAGE"));
  assert.equal(created?.imagePath, "/uploads/from-media.jpg");
});

serialTest("admin product upsert preserves an active product image when image fields are omitted", async () => {
  const ids = await getBaselineIds();
  const payload = {
    ...makeCompleteProduct(ids.leafCategoryId),
    media: [
      { type: "image" as const, url: "/uploads/primary.jpg" },
      { type: "image" as const, url: "/uploads/secondary.jpg" },
      { type: "video" as const, url: "/uploads/demo.mp4" }
    ]
  };

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const createResponse = await request("/api/erp/products", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    assert.equal(createResponse.status, 200);

    const [created] = await db
      .select({ id: products.id, imagePath: products.imagePath })
      .from(products)
      .where(eq(products.sku, payload.sku));
    assert.ok(created);

    const updateResponse = await request("/api/erp/products", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ...payload, id: created.id, imagePath: undefined, media: undefined })
    });
    assert.equal(updateResponse.status, 200);

    const [updated] = await db
      .select({ imagePath: products.imagePath })
      .from(products)
      .where(eq(products.id, created.id));
    assert.equal(updated?.imagePath, created.imagePath);

    const mediaRows = await db
      .select({ type: entityMedia.mediaType, url: entityMedia.url })
      .from(entityMedia)
      .where(eq(entityMedia.productId, created.id))
      .orderBy(asc(entityMedia.sortOrder));
    assert.deepEqual(mediaRows, payload.media);
  });
});

serialTest("admin product upsert rejects activating a product missing the English name", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sku: "ROUTE-NO-EN",
        name: { ar: "بدون انجليزي" },
        keywords: ["test"],
        imagePath: "/uploads/test.jpg",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [{ size: "100ml", price: 250, stock: 10 }]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "cannot-activate-incomplete-product");
  });
});

serialTest("admin product upsert rejects activating a product missing the Arabic name", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sku: "ROUTE-NO-AR",
        name: { en: "No Arabic" },
        keywords: ["test"],
        imagePath: "/uploads/test.jpg",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [{ size: "100ml", price: 250, stock: 10 }]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "cannot-activate-incomplete-product");
  });
});

serialTest("admin product upsert allows an incomplete product when status is inactive", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sku: "ROUTE-INACTIVE-INCOMPLETE",
        name: { ar: "غير نشط", en: "Inactive" },
        status: "inactive",
        categoryId: ids.leafCategoryId,
        variants: []
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });
});

serialTest("admin product upsert activates a complete product successfully", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify(makeCompleteProduct(ids.leafCategoryId))
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });
});

serialTest("admin product upsert persists a variant discount for a targeted variant", async () => {
  const ids = await getBaselineIds();

  await db.delete(offerItems).where(eq(offerItems.variantId, ids.firstVariantId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: ids.productOneId,
        sku: "TEST-SKU-001",
        slug: "test-product-baseline-1",
        name: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
        description: { ar: "وصف", en: "Description" },
        keywords: ["test", "baseline"],
        imagePath: "/uploads/test-baseline.png",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [
          {
            id: ids.firstVariantId,
            size: "100ml",
            price: 35,
            stock: 10,
            discount: {
              type: "percentage",
              value: 20,
              startsAt: "2026-06-01T00:00:00.000Z",
              endsAt: "2026-06-30T23:59:59.000Z",
              status: "active"
            }
          }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [discount] = await db
    .select({
      variantId: variantDiscounts.variantId,
      type: variantDiscounts.type,
      value: variantDiscounts.value,
      status: variantDiscounts.status
    })
    .from(variantDiscounts)
    .where(eq(variantDiscounts.variantId, ids.firstVariantId))
    .limit(1);

  assert.equal(discount?.variantId, ids.firstVariantId);
  assert.equal(discount?.type, "percentage");
  assert.equal(Number(discount?.value), 20);
  assert.equal(discount?.status, "active");
});

serialTest("admin product upsert rejects a fixed discount that would zero out or exceed the variant price", async () => {
  const ids = await getBaselineIds();

  await db.delete(offerItems).where(eq(offerItems.variantId, ids.firstVariantId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: ids.productOneId,
        sku: "TEST-SKU-001",
        slug: "test-product-baseline-1",
        name: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
        description: { ar: "وصف", en: "Description" },
        keywords: ["test", "baseline"],
        imagePath: "/uploads/test-baseline.png",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [
          {
            id: ids.firstVariantId,
            size: "100ml",
            price: 35,
            stock: 10,
            discount: {
              type: "fixed",
              value: 35,
              startsAt: "2026-06-01T00:00:00.000Z",
              endsAt: "2026-06-30T23:59:59.000Z",
              status: "active"
            }
          }
        ]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-variant-discount");
  });
});

serialTest("admin product discount update preserves an existing discount when the request omits the discount field", async () => {
  const ids = await getBaselineIds();

  await db.insert(variantDiscounts).values({
    variantId: ids.firstVariantId,
    type: "percentage",
    value: "20.00",
    startsAt: new Date("2026-06-01T00:00:00.000Z"),
    endsAt: new Date("2026-06-30T23:59:59.000Z"),
    status: "active"
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/discount`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        variants: [{ id: ids.firstVariantId }]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [discount] = await db
    .select({
      variantId: variantDiscounts.variantId,
      type: variantDiscounts.type,
      value: variantDiscounts.value,
      status: variantDiscounts.status
    })
    .from(variantDiscounts)
    .where(eq(variantDiscounts.variantId, ids.firstVariantId))
    .limit(1);

  assert.equal(discount?.variantId, ids.firstVariantId);
  assert.equal(discount?.type, "percentage");
  assert.equal(Number(discount?.value), 20);
  assert.equal(discount?.status, "active");
});

serialTest("admin product discount update validates fixed discounts against the persisted variant price", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/discount`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        variants: [{
          id: ids.firstVariantId,
          price: 999,
          discount: {
            type: "fixed",
            value: 35,
            startsAt: "2026-06-01T00:00:00.000Z",
            endsAt: "2026-06-30T23:59:59.000Z",
            status: "active"
          }
        }]
      })
    });

    assert.equal(response.status, 400);
    assert.equal(response.json.reason, "invalid-variant-discount");
  });
});

serialTest("admin product upsert persists ordered media and a dedicated hover image separately", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...makeCompleteProduct(ids.leafCategoryId),
        sku: "ROUTE-MEDIA-COMPLETE",
        arHoverImagePath: "/uploads/route-hover-ar.jpg",
        enHoverImagePath: "/uploads/route-hover-en.jpg",
        media: [
          { type: "image", arUrl: "/uploads/route-primary-ar.jpg", enUrl: "/uploads/route-primary-en.jpg" },
          { type: "image", arUrl: null, enUrl: "/uploads/route-gallery-secondary.jpg" },
          { type: "video", url: "/uploads/route-demo.mp4" }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [created] = await db
    .select({
      id: products.id,
      imagePath: products.imagePath,
      hoverImagePath: products.hoverImagePath,
      arHoverImagePath: products.arHoverImagePath
    })
    .from(products)
    .where(eq(products.sku, "ROUTE-MEDIA-COMPLETE"))
    .limit(1);

  assert.ok(created, "expected created product to exist");
  assert.equal(created.imagePath, "/uploads/route-primary-en.jpg");
  assert.equal(created.hoverImagePath, "/uploads/route-hover-en.jpg");
  assert.equal(created.arHoverImagePath, "/uploads/route-hover-ar.jpg");

  const mediaRows = await db
    .select({
      mediaType: entityMedia.mediaType,
      url: entityMedia.url,
      arUrl: entityMedia.arUrl,
      sortOrder: entityMedia.sortOrder
    })
    .from(entityMedia)
    .where(eq(entityMedia.productId, created.id))
    .orderBy(asc(entityMedia.sortOrder));

  assert.deepEqual(mediaRows, [
    { mediaType: "image", url: "/uploads/route-primary-en.jpg", arUrl: "/uploads/route-primary-ar.jpg", sortOrder: 1 },
    { mediaType: "image", url: "/uploads/route-gallery-secondary.jpg", arUrl: null, sortOrder: 2 },
    { mediaType: "video", url: "/uploads/route-demo.mp4", arUrl: null, sortOrder: 3 }
  ]);
});

serialTest("admin product upsert preserves an explicitly missing English hover image", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...makeCompleteProduct(ids.leafCategoryId),
        sku: "ROUTE-HOVER-AR-ONLY",
        hoverImagePath: "/uploads/route-hover-ar-only.jpg",
        arHoverImagePath: "/uploads/route-hover-ar-only.jpg",
        enHoverImagePath: null
      })
    });

    assert.equal(response.status, 200);
  });

  const [created] = await db
    .select({
      hoverImagePath: products.hoverImagePath,
      arHoverImagePath: products.arHoverImagePath
    })
    .from(products)
    .where(eq(products.sku, "ROUTE-HOVER-AR-ONLY"))
    .limit(1);

  assert.deepEqual(created, {
    hoverImagePath: null,
    arHoverImagePath: "/uploads/route-hover-ar-only.jpg"
  });
});

serialTest("admin product upsert persists mirrored related product links", async () => {
  const ids = await getBaselineIds();

  const createResponse = await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    return request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...makeCompleteProduct(ids.leafCategoryId),
        sku: "ROUTE-RELATED-PRODUCT",
        relatedItems: [{ type: "product", id: ids.productTwoId }]
      })
    });
  });

  assert.equal(createResponse.status, 200);
  assert.equal(createResponse.json.ok, true);

  const [created] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, "ROUTE-RELATED-PRODUCT"))
    .limit(1);

  assert.ok(created, "expected created product to exist");

  const relatedRows = await db
    .select({
      sourceType: relatedItems.sourceType,
      sourceId: relatedItems.sourceId,
      targetType: relatedItems.targetType,
      targetId: relatedItems.targetId,
      rank: relatedItems.rank
    })
    .from(relatedItems)
    .where(
      or(
        and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, created.id)),
        and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, ids.productTwoId))
      )
    )
    .orderBy(asc(relatedItems.id));

  assert.deepEqual(relatedRows, [
    { sourceType: "product", sourceId: created.id, targetType: "product", targetId: ids.productTwoId, rank: 1 },
    { sourceType: "product", sourceId: ids.productTwoId, targetType: "product", targetId: created.id, rank: 1 }
  ]);
});

serialTest("admin product detail returns a related-items array for editing", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}`, {
      headers: {
        ...authHeaders
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.id, ids.productOneId);
    assert.ok(Array.isArray(response.json.relatedItems));
  });
});

serialTest("admin product upsert preserves existing related links when relatedItems is omitted", async () => {
  const ids = await getBaselineIds();

  // This test replaces productOne's variant set, which requires its variant not be
  // linked to the baseline offer or collection (the seed links it). Unlink it for this scenario.
  await db.delete(offerItems).where(eq(offerItems.variantId, ids.firstVariantId));
  await db.delete(collectionItems).where(eq(collectionItems.variantId, ids.firstVariantId));

  await db.insert(relatedItems).values([
    {
      sourceType: "product",
      sourceId: ids.productOneId,
      targetType: "product",
      targetId: ids.productTwoId,
      rank: 1
    },
    {
      sourceType: "product",
      sourceId: ids.productTwoId,
      targetType: "product",
      targetId: ids.productOneId,
      rank: 1
    }
  ]);

  const before = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, ids.productOneId)))
    .orderBy(asc(relatedItems.rank), asc(relatedItems.id));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        // Keep the seed SKU/slug so the seed-based test reset can still find and
        // clean this row (renaming to a fresh SKU escapes cleanup and pollutes
        // later runs via products_sku_unique).
        id: ids.productOneId,
        sku: "TEST-SKU-001",
        slug: "test-product-baseline-1",
        name: { ar: "محدث", en: "Updated" },
        description: { ar: "وصف", en: "Description" },
        keywords: ["skincare"],
        imagePath: "/uploads/test.jpg",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [{ size: "100ml", price: 250, stock: 10 }]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const after = await db
    .select({ targetType: relatedItems.targetType, targetId: relatedItems.targetId, rank: relatedItems.rank })
    .from(relatedItems)
    .where(and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, ids.productOneId)))
    .orderBy(asc(relatedItems.rank), asc(relatedItems.id));

  assert.deepEqual(after, before);
});

serialTest("admin product upsert preserves linked variant ids when editing an existing variant", async () => {
  const ids = await getBaselineIds();

  // The baseline seed already links productOne's variant to the baseline offer
  // (a duplicate offer_item would violate the offer_items unique constraint).

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: ids.productOneId,
        sku: "TEST-SKU-001",
        slug: "test-product-baseline-1",
        name: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
        description: { ar: "محدث", en: "Updated" },
        keywords: ["test", "baseline"],
        imagePath: "/uploads/test-baseline.png",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [
          { id: ids.firstVariantId, size: "150ml", price: 99, stock: 7 }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [updatedVariant] = await db
    .select({
      id: productVariants.id,
      sizeLabel: productVariants.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty
    })
    .from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId))
    .limit(1);

  assert.ok(updatedVariant, "expected linked variant row to be updated in place");
  assert.equal(updatedVariant.sizeLabel, "150ml");
  assert.equal(Number(updatedVariant.sellingPrice), 99);
  assert.equal(updatedVariant.stockQty, 7);

  const offerLinks = await db
    .select({ variantId: offerItems.variantId })
    .from(offerItems)
    .where(eq(offerItems.offerId, ids.offerId));

  // Editing the variant in place must preserve its existing offer link.
  assert.ok(
    offerLinks.some((link) => link.variantId === ids.firstVariantId),
    "expected the edited variant to remain linked to the offer"
  );
});

serialTest("admin product upsert normalizes variant size whitespace before saving", async () => {
  const ids = await getBaselineIds();

  await db.delete(offerItems).where(eq(offerItems.variantId, ids.firstVariantId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: ids.productOneId,
        sku: "TEST-SKU-001",
        slug: "test-product-baseline-1",
        name: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
        description: { ar: "وصف", en: "Description" },
        keywords: ["test", "baseline"],
        imagePath: "/uploads/test-baseline.png",
        status: "active",
        categoryId: ids.leafCategoryId,
        variants: [{ id: ids.firstVariantId, size: "  100   ml  ", price: 99, stock: 7 }]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [updatedVariant] = await db
    .select({ sizeLabel: productVariants.sizeLabel })
    .from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId))
    .limit(1);

  assert.equal(updatedVariant?.sizeLabel, "100 ml");
});

serialTest("admin product upsert rejects removing a variant that is used by an offer", async () => {
  const ids = await getBaselineIds();

  // The baseline seed already links productOne's variant to the baseline offer.

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id: ids.productOneId,
        sku: "TEST-SKU-001",
        slug: "test-product-baseline-1",
        name: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
        description: { ar: "وصف", en: "Description" },
        keywords: ["test", "baseline"],
        imagePath: "/uploads/test-baseline.png",
        status: "active",
        categoryId: ids.leafCategoryId,
        // Drop the offer-linked variant (no id matching the seed variant) while
        // keeping the product active with a different new variant, so the request
        // passes activation validation and reaches the offer-link guard.
        variants: [{ size: "250ml", price: 99, stock: 5 }]
      })
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "linked-to-offers");
  });
});

serialTest("admin product toggle-status flips the persisted DB status", async () => {
  const ids = await getBaselineIds();

  const [before] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, ids.productOneId))
    .limit(1);

  assert.ok(before, "expected baseline product to exist");
  assert.equal(before.status, "active");

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/toggle-status`, {
      method: "POST",
      headers: {
        ...authHeaders
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [afterFirstToggle] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, ids.productOneId))
    .limit(1);

  assert.ok(afterFirstToggle, "expected product after first toggle");
  assert.equal(afterFirstToggle.status, "inactive");

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/toggle-status`, {
      method: "POST",
      headers: {
        ...authHeaders
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [afterSecondToggle] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, ids.productOneId))
    .limit(1);

  assert.ok(afterSecondToggle, "expected product after second toggle");
  assert.equal(afterSecondToggle.status, "active");
});

serialTest("admin variant stock update rejects mismatched product and variant ids", async () => {
  const ids = await getBaselineIds();

  const [before] = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, ids.secondVariantId))
    .limit(1);

  assert.ok(before, "expected baseline variant to exist");

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/variants/${ids.secondVariantId}/stock`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({ stock: 99 })
    });

    assert.equal(response.status, 404);
    assert.equal(response.json.message, "Variant not found");
  });

  const [after] = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, ids.secondVariantId))
    .limit(1);

  assert.equal(after?.stockQty, before.stockQty);
});

serialTest("admin products list includes soft-deleted products for ERP trash", async () => {
  const ids = await getBaselineIds();

  await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, ids.productOneId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/products", {
      headers: {
        ...authHeaders
      }
    });

    assert.equal(response.status, 200);
    const deletedProduct = response.json.items.find((item: any) => item.id === ids.productOneId);
    assert.ok(deletedProduct, "expected soft-deleted product to be returned");
    assert.ok(deletedProduct.deletedAt, "expected soft-deleted product to expose deletedAt");
  });
});

serialTest("admin hard-delete removes product, variants, wishlists, and image file", async () => {
  const ids = await getBaselineIds();

  // Unlink the seed offer item so productOne is freely hard-deletable.
  await db.delete(offerItems).where(eq(offerItems.variantId, ids.firstVariantId));

  const uploadsDir = resolve(process.cwd(), "uploads");
  const fileName = `test-hard-delete-${ids.productOneId}.jpg`;
  const absolutePath = resolve(uploadsDir, fileName);
  const secondaryFileName = `test-hard-delete-secondary-${ids.productOneId}.jpg`;
  const secondaryAbsolutePath = resolve(uploadsDir, secondaryFileName);
  const sharedMediaFileName = `test-hard-delete-shared-media-${ids.productOneId}.jpg`;
  const sharedMediaAbsolutePath = resolve(uploadsDir, sharedMediaFileName);
  const sharedLegacyFileName = `test-hard-delete-shared-legacy-${ids.productOneId}.jpg`;
  const sharedLegacyAbsolutePath = resolve(uploadsDir, sharedLegacyFileName);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(absolutePath, "fake-image-bytes");
  await writeFile(secondaryAbsolutePath, "fake-secondary-image-bytes");
  await writeFile(sharedMediaAbsolutePath, "fake-shared-media-bytes");
  await writeFile(sharedLegacyAbsolutePath, "fake-shared-legacy-bytes");

  await db.update(products).set({ deletedAt: new Date(), imagePath: `/uploads/${fileName}` }).where(eq(products.id, ids.productOneId));
  await db.insert(entityMedia).values([
    { productId: ids.productOneId, mediaType: "image", url: `/uploads/${fileName}`, sortOrder: 1 },
    { productId: ids.productOneId, mediaType: "image", url: `http://localhost:4000/uploads/${secondaryFileName}`, sortOrder: 2 },
    { productId: ids.productOneId, mediaType: "image", url: `/uploads/${sharedMediaFileName}`, sortOrder: 3 },
    { productId: ids.productOneId, mediaType: "image", url: `/uploads/${sharedLegacyFileName}`, sortOrder: 4 },
    { productId: ids.productTwoId, mediaType: "image", url: `http://localhost:4000/uploads/${sharedMediaFileName}`, sortOrder: 99 }
  ]);
  await db.update(products).set({ imagePath: `/uploads/${sharedLegacyFileName}` }).where(eq(products.id, ids.productTwoId));
  await db.insert(wishlists).values({ customerId: ids.customerId, entityType: "product", entityId: ids.productOneId });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 204);
  });

  const remaining = await db.select({ id: products.id }).from(products).where(eq(products.id, ids.productOneId));
  assert.equal(remaining.length, 0, "expected product row to be gone");

  const remainingVariants = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, ids.productOneId));
  assert.equal(remainingVariants.length, 0, "expected variants to cascade-delete");

  const remainingWishlists = await db
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(and(eq(wishlists.entityType, "product"), eq(wishlists.entityId, ids.productOneId)));
  assert.equal(remainingWishlists.length, 0, "expected wishlist rows to be removed");

  await assert.rejects(access(absolutePath), "expected image file to be unlinked");
  await assert.rejects(access(secondaryAbsolutePath), "expected secondary media file to be unlinked");
  await access(sharedMediaAbsolutePath);
  await access(sharedLegacyAbsolutePath);
  await unlink(sharedMediaAbsolutePath);
  await unlink(sharedLegacyAbsolutePath);
});

serialTest("admin soft-delete rejects products whose variants are used by offers", async () => {
  const ids = await getBaselineIds();

  // The baseline seed already links productOne's variant to the baseline offer,
  // so no extra offer_item is needed (and a duplicate would violate the
  // offer_items (offer_id, variant_id) unique constraint).

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "linked-to-offers");
  });
});

serialTest("admin hard-delete rejects products whose variants are used by offers", async () => {
  const ids = await getBaselineIds();

  // Baseline seed already links productOne's variant to the baseline offer
  // (a duplicate offer_item would violate the new unique constraint).
  await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, ids.productOneId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.reason, "linked-to-offers");
  });
});

serialTest("admin hard-delete on a product that is not soft-deleted returns 404 and leaves data intact", async () => {
  const ids = await getBaselineIds();

  // Unlink the seed offer item so the only reason for a non-204 is the trash check.
  await db.delete(offerItems).where(eq(offerItems.variantId, ids.firstVariantId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 404);
    assert.equal(response.json.reason, "not-in-trash");
  });

  const [stillThere] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, ids.productOneId))
    .limit(1);
  assert.ok(stillThere, "expected product to still exist");
});

serialTest("admin hard-delete tolerates a missing image file", async () => {
  const ids = await getBaselineIds();
  // Unlink the seed offer item so productOne is freely hard-deletable.
  await db.delete(offerItems).where(eq(offerItems.variantId, ids.firstVariantId));
  await db.update(products).set({ deletedAt: new Date(), imagePath: "/uploads/does-not-exist.jpg" }).where(eq(products.id, ids.productOneId));

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/products/${ids.productOneId}/permanent`, {
      method: "DELETE",
      headers: { ...authHeaders }
    });
    assert.equal(response.status, 204);
  });

  const remaining = await db.select({ id: products.id }).from(products).where(eq(products.id, ids.productOneId));
  assert.equal(remaining.length, 0);
});

serialTest("admin product revalidation includes both old and new category paths when a product moves categories", async () => {
  const ids = await getBaselineIds();
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  const calls: Array<{ input: string; init?: RequestInit }> = [];

  const targetRootSlug = `hair-care-${Date.now()}`;
  const targetLeafSlug = `hair-mask-${Date.now()}`;
  const [targetRoot] = await db.insert(categories).values({
    slug: targetRootSlug,
    arName: "العناية بالشعر",
    enName: "Hair Care",
    isLeaf: false
  }).$returningId();
  const [targetLeaf] = await db.insert(categories).values({
    slug: targetLeafSlug,
    arName: "ماسك الشعر",
    enName: "Hair Mask",
    isLeaf: true,
    parentId: targetRoot.id
  }).$returningId();

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
      const response = await request("/api/erp/products", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: ids.productOneId,
          sku: "TEST-SKU-001",
          slug: "test-product-baseline-1",
          name: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
          description: { ar: "وصف", en: "Description" },
          keywords: ["test", "baseline"],
          imagePath: "/uploads/test-baseline.png",
          status: "active",
          categoryId: targetLeaf.id,
          variants: [{ id: ids.firstVariantId, size: "100ml", price: 99, stock: 7 }]
        })
      });

      assert.equal(response.status, 200);
      assert.equal(response.json.ok, true);
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    entity: "product",
    slug: "test-product-baseline-1",
    categorySlugs: ["body-care", "body-lotion", targetRootSlug, targetLeafSlug]
  });
});

serialTest("admin product revalidation includes the previous slug when a product slug changes", async () => {
  const ids = await getBaselineIds();
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
      const response = await request("/api/erp/products", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          id: ids.productOneId,
          sku: "TEST-SKU-001",
          slug: "renamed-product",
          name: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
          description: { ar: "وصف", en: "Description" },
          keywords: ["test", "baseline"],
          imagePath: "/uploads/test-baseline.png",
          status: "active",
          categoryId: ids.leafCategoryId,
          variants: [{ id: ids.firstVariantId, size: "100ml", price: 99, stock: 7 }]
        })
      });

      assert.equal(response.status, 200);
      assert.equal(response.json.ok, true);
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    entity: "product",
    slug: "renamed-product",
    previousSlug: "test-product-baseline-1",
    categorySlugs: ["body-care", "body-lotion"]
  });
});
