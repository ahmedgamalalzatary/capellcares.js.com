import assert from "node:assert/strict";
import test from "node:test";

import { loadWorkspaceEnv } from "../../src/config/env.js";

loadWorkspaceEnv();

test("createAdminProductRepo creates product when provided id does not exist", async () => {
  const { eq } = await import("drizzle-orm");
  const { products } = await import("@capella/database/drizzle/schema");
  const { db } = await import("@capella/database/src/db");
  const { createAdminProductRepo } = await import("../../src/repositories/product.repository.js");

  const sku = `TDD-SKU-${Date.now()}`;
  const slug = `tdd-product-${Date.now()}`;
  const requestedId = 987654321;

  const created = await createAdminProductRepo({
    id: requestedId,
    sku,
    slug,
    arName: "اختبار",
    enName: "test",
    buyingPrice: 10,
    keywords: "test,repo",
    imagePath: "/uploads/test.png",
    categoryId: 1,
    status: "inactive",
    isNew: false,
    isBestseller: false
  });

  const [createdProduct] = await db
    .select({ id: products.id, sku: products.sku, categoryId: products.categoryId })
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);

  assert.ok(createdProduct, "expected product row to be inserted");
  assert.equal(createdProduct.sku, sku);
  assert.equal(createdProduct.categoryId, 1);
  assert.notEqual(createdProduct.id, requestedId);
  assert.equal(created.id, createdProduct.id);
  await db.delete(products).where(eq(products.id, createdProduct.id));
});
