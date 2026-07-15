import assert from "node:assert/strict";
import test from "node:test";

import { loadWorkspaceEnv } from "../../src/config/env.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

loadWorkspaceEnv();

test("createAdminProduct accepts the ERP product payload shape", async () => {
  const { eq } = await import("drizzle-orm");
  const { productSizes, productVariants, products } = await import("@minikoshk/database/drizzle/schema");
  const { db } = await import("@minikoshk/database/src/db");
  const { createAdminProduct } = await import("../../src/modules/admin/products/admin-products.service.js");

  const unique = Date.now();
  const sku = `ERP-SKU-${unique}`;
  await resetApiTestDatabase();
  const ids = await getBaselineIds();
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
    categoryId: ids.leafCategoryId,
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
  assert.equal(createdProduct.categoryId, ids.leafCategoryId);

  const createdVariants = await db
    .select({
      sizeLabel: productSizes.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty
    })
    .from(productVariants)
    .innerJoin(productSizes, eq(productSizes.id, productVariants.sizeId))
    .where(eq(productVariants.productId, created.id));

  assert.equal(createdVariants.length, 1);
  assert.equal(createdVariants[0]?.sizeLabel, "100ml");
  assert.equal(Number(createdVariants[0]?.sellingPrice), 45);
  assert.equal(createdVariants[0]?.stockQty, 7);

  await db.delete(productVariants).where(eq(productVariants.productId, created.id));
  await db.delete(products).where(eq(products.id, created.id));
});

test("createAdminProduct rolls back the product when its option matrix is invalid", async () => {
  const { eq } = await import("drizzle-orm");
  const { products } = await import("@minikoshk/database/drizzle/schema");
  const { db } = await import("@minikoshk/database/src/db");
  const { createAdminProduct } = await import("../../src/modules/admin/products/admin-products.service.js");

  await resetApiTestDatabase();
  const ids = await getBaselineIds();
  const sku = `ERP-ROLLBACK-${Date.now()}`;

  await assert.rejects(() => createAdminProduct({
    sku,
    name: { ar: "اختبار", en: "Rollback test" },
    keywords: ["test"],
    buyingPrice: 10,
    status: "inactive",
    categoryId: ids.leafCategoryId,
    sizes: [{ id: -1, label: "100ml" }],
    colors: [{ id: -2, hex: "#FFFFFF" }, { id: -3, hex: "#000000" }],
    variants: [{ sizeId: -1, colorId: -2, price: 20, stock: 1 }]
  } as any), /complete size and color matrix/i);

  const rows = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku));
  assert.equal(rows.length, 0);
});

test("createAdminProduct rejects mixed variant representations", async () => {
  const { eq } = await import("drizzle-orm");
  const { products } = await import("@minikoshk/database/drizzle/schema");
  const { db } = await import("@minikoshk/database/src/db");
  const { createAdminProduct } = await import("../../src/modules/admin/products/admin-products.service.js");

  await resetApiTestDatabase();
  const ids = await getBaselineIds();
  const sku = `ERP-MIXED-${Date.now()}`;

  await assert.rejects(() => createAdminProduct({
    sku,
    name: { ar: "اختبار", en: "Mixed variants" },
    buyingPrice: 10,
    status: "inactive",
    categoryId: ids.leafCategoryId,
    sizes: [{ id: -1, label: "S" }],
    variants: [
      { sizeId: -1, colorId: null, price: 20, stock: 1 },
      { size: "M", price: 25, stock: 1 }
    ]
  } as any), /representation/i);

  const rows = await db.select({ id: products.id }).from(products).where(eq(products.sku, sku));
  assert.equal(rows.length, 0);
});
