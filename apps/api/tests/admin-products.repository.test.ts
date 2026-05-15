import assert from "node:assert/strict";
import test from "node:test";

import { loadWorkspaceEnv } from "../src/config/env.js";

loadWorkspaceEnv();

test("createAdminProductRepo creates product when provided id does not exist", async () => {
  const { eq } = await import("drizzle-orm");
  const { productVariants, products } = await import("@capella/database/drizzle/schema");
  const { db } = await import("@capella/database/src/db");
  const { createAdminProductRepo, replaceVariantsRepo } = await import("../src/repositories/product.repository.js");

  const sku = `TDD-SKU-${Date.now()}`;
  const slug = `tdd-product-${Date.now()}`;

  const created = await createAdminProductRepo({
    id: 987654321,
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

  await replaceVariantsRepo(created.id, [
    { sizeLabel: "100ml", sellingPrice: 20, stockQty: 5 }
  ]);

  const [createdProduct] = await db
    .select({ id: products.id, sku: products.sku, categoryId: products.categoryId })
    .from(products)
    .where(eq(products.sku, sku))
    .limit(1);

  assert.ok(createdProduct, "expected product row to be inserted");
  assert.equal(createdProduct.sku, sku);
  assert.equal(createdProduct.categoryId, 1);
  assert.notEqual(createdProduct.id, 987654321);

  const linkedVariants = await db
    .select({ id: productVariants.id, productId: productVariants.productId })
    .from(productVariants)
    .where(eq(productVariants.productId, createdProduct.id));

  assert.equal(linkedVariants.length, 1);

  await db.delete(productVariants).where(eq(productVariants.productId, createdProduct.id));
  await db.delete(products).where(eq(products.id, createdProduct.id));
});
