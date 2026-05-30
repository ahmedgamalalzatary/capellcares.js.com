import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";

import { and, asc, eq, or } from "drizzle-orm";
import { productMedia, products, productVariants, relatedItems, wishlists } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

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

test("admin product upsert rejects activating a product with no variants", async () => {
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

test("admin product upsert rejects activating a product with no keywords", async () => {
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

test("admin product upsert rejects activating a product with no image", async () => {
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

test("admin product upsert rejects activating a product missing the English name", async () => {
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

test("admin product upsert rejects activating a product missing the Arabic name", async () => {
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

test("admin product upsert allows an incomplete product when status is inactive", async () => {
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

test("admin product upsert activates a complete product successfully", async () => {
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

test("admin product upsert persists ordered media and a dedicated hover image separately", async () => {
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
        hoverImagePath: "/uploads/route-hover-dedicated.jpg",
        media: [
          { type: "image", url: "/uploads/route-primary.jpg" },
          { type: "image", url: "/uploads/route-gallery-secondary.jpg" },
          { type: "video", url: "/uploads/route-demo.mp4" }
        ]
      })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [created] = await db
    .select({ id: products.id, imagePath: products.imagePath, hoverImagePath: products.hoverImagePath })
    .from(products)
    .where(eq(products.sku, "ROUTE-MEDIA-COMPLETE"))
    .limit(1);

  assert.ok(created, "expected created product to exist");
  assert.equal(created.imagePath, "/uploads/route-primary.jpg");
  assert.equal(created.hoverImagePath, "/uploads/route-hover-dedicated.jpg");

  const mediaRows = await db
    .select({
      mediaType: productMedia.mediaType,
      url: productMedia.url,
      sortOrder: productMedia.sortOrder
    })
    .from(productMedia)
    .where(eq(productMedia.productId, created.id));

  assert.deepEqual(mediaRows, [
    { mediaType: "image", url: "/uploads/route-primary.jpg", sortOrder: 1 },
    { mediaType: "image", url: "/uploads/route-gallery-secondary.jpg", sortOrder: 2 },
    { mediaType: "video", url: "/uploads/route-demo.mp4", sortOrder: 3 }
  ]);
});

test("admin product upsert persists mirrored related product links", async () => {
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

test("admin product detail returns a related-items array for editing", async () => {
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

test("admin product toggle-status flips the persisted DB status", async () => {
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

test("admin products list includes soft-deleted products for ERP trash", async () => {
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

test("admin hard-delete removes product, variants, wishlists, and image file", async () => {
  const ids = await getBaselineIds();

  const uploadsDir = resolve(process.cwd(), "uploads");
  const fileName = `test-hard-delete-${ids.productOneId}.jpg`;
  const absolutePath = resolve(uploadsDir, fileName);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(absolutePath, "fake-image-bytes");

  await db.update(products).set({ deletedAt: new Date(), imagePath: `/uploads/${fileName}` }).where(eq(products.id, ids.productOneId));
  await db.insert(wishlists).values({ customerId: 999999, productId: ids.productOneId });

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
    .where(eq(wishlists.productId, ids.productOneId));
  assert.equal(remainingWishlists.length, 0, "expected wishlist rows to be removed");

  await assert.rejects(access(absolutePath), "expected image file to be unlinked");
});

test("admin hard-delete on a product that is not soft-deleted returns 404 and leaves data intact", async () => {
  const ids = await getBaselineIds();

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

test("admin hard-delete tolerates a missing image file", async () => {
  const ids = await getBaselineIds();
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
