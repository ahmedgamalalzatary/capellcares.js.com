import assert from "node:assert/strict";
import test from "node:test";

import { loadWorkspaceEnv } from "../../src/config/env.js";

loadWorkspaceEnv();

test("createAdminProduct accepts the ERP product payload shape", async () => {
  const { eq } = await import("drizzle-orm");
  const { productVariants, products } = await import("@capella/database/drizzle/schema");
  const { db } = await import("@capella/database/src/db");
  const { createAdminProduct } = await import("../../src/modules/admin/products/admin-products.service.js");

  const unique = Date.now();
  const sku = `ERP-SKU-${unique}`;
  const created = await createAdminProduct({
    sku,
    name: { ar: "منتج اختبار", en: "Service Test Product" },
    description: { ar: "وصف", en: "Description" },
    ingredients: { ar: "مكونات", en: "Ingredients" },
    howToUse: { ar: "استخدام", en: "Use" },
    warnings: { ar: "تحذيرات", en: "Warnings" },
    keywords: ["test", "service"],
    buyingPrice: 25,
    imagePath: "/uploads/service-test.png",
    youtubeUrl: "https://youtube.com/watch?v=test",
    status: "inactive",
    categoryId: 1,
    variants: [{ id: 1111, productId: 0, size: "100ml", price: 45, stock: 7 }],
    offerIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as any);

  const [createdProduct] = await db
    .select({
      id: products.id,
      sku: products.sku,
      arName: products.arName,
      enName: products.enName,
      categoryId: products.categoryId
    })
    .from(products)
    .where(eq(products.id, created.id))
    .limit(1);

  assert.ok(createdProduct, "expected product row to be inserted");
  assert.equal(createdProduct.sku, sku);
  assert.equal(createdProduct.arName, "منتج اختبار");
  assert.equal(createdProduct.enName, "Service Test Product");
  assert.equal(createdProduct.categoryId, 1);

  const createdVariants = await db
    .select({
      sizeLabel: productVariants.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty
    })
    .from(productVariants)
    .where(eq(productVariants.productId, created.id));

  assert.equal(createdVariants.length, 1);
  assert.equal(createdVariants[0]?.sizeLabel, "100ml");
  assert.equal(Number(createdVariants[0]?.sellingPrice), 45);
  assert.equal(createdVariants[0]?.stockQty, 7);

  await db.delete(productVariants).where(eq(productVariants.productId, created.id));
  await db.delete(products).where(eq(products.id, created.id));
});
