import assert from "node:assert/strict";
import test from "node:test";

import {
  canActivateAdminProduct,
  normalizeAdminProductInput
} from "../../src/modules/admin/products/lib/admin-product-input.js";

test("normalizeAdminProductInput maps the ERP form shape", () => {
  const result = normalizeAdminProductInput({
    sku: "SKU-1",
    name: { ar: "اسم", en: "Name" },
    description: { ar: "وصف", en: "Desc" },
    ingredients: { ar: "مكونات", en: "Ingredients" },
    howToUse: { ar: "طريقة", en: "How" },
    warnings: { ar: "تحذير", en: "Warn" },
    keywords: ["k1"],
    buyingPrice: 12,
    imagePath: "/img.png",
    youtubeUrl: "https://yt/x",
    status: "active",
    categoryId: 9,
    variants: [{ size: "100ml", price: 50, stock: 7 }]
  });

  assert.equal(result.arName, "اسم");
  assert.equal(result.enName, "Name");
  assert.equal(result.arDescription, "وصف");
  assert.equal(result.enIngredients, "Ingredients");
  assert.equal(result.arHowToUse, "طريقة");
  assert.equal(result.enWarnings, "Warn");
  assert.equal(result.buyingPrice, 12);
  assert.equal(result.youtubeUrl, "https://yt/x");
  assert.equal(result.categoryId, 9);
  assert.deepEqual(result.variants, [{ sizeLabel: "100ml", sellingPrice: 50, stockQty: 7 }]);
});

test("normalizeAdminProductInput maps the API/domain shape", () => {
  const result = normalizeAdminProductInput({
    sku: "SKU-2",
    arName: "اسم",
    enName: "Name",
    arDescription: "وصف",
    enDescription: "Desc",
    arIngredients: "مكونات",
    buyingPrice: 20,
    categoryId: 4,
    imagePath: "/img.png",
    keywords: ["a", "b"],
    status: "inactive",
    variants: [{ sizeLabel: "200ml", sellingPrice: 80, stockQty: 3 }]
  } as never);

  assert.equal(result.arName, "اسم");
  assert.equal(result.arIngredients, "مكونات");
  assert.equal(result.buyingPrice, 20);
  assert.equal(result.categoryId, 4);
  assert.deepEqual(result.keywords, ["a", "b"]);
  assert.deepEqual(result.variants, [{ sizeLabel: "200ml", sellingPrice: 80, stockQty: 3 }]);
});

test("normalizeAdminProductInput defaults missing fields", () => {
  const result = normalizeAdminProductInput({ status: "inactive" } as never);
  assert.equal(result.arName, "");
  assert.equal(result.enName, "");
  assert.equal(result.buyingPrice, 0);
  assert.equal(result.categoryId, 0);
  assert.deepEqual(result.keywords, []);
  assert.deepEqual(result.variants, []);
});

test("canActivateAdminProduct requires the core sellable fields", () => {
  const base = {
    arName: "اسم",
    enName: "Name",
    keywords: ["k"],
    imagePath: "/img.png",
    categoryId: 1,
    buyingPrice: 0,
    status: "active" as const,
    variants: [{ sizeLabel: "100ml", sellingPrice: 50, stockQty: 1 }]
  };
  assert.equal(canActivateAdminProduct(base), true);
  assert.equal(canActivateAdminProduct({ ...base, imagePath: undefined }), false);
  assert.equal(canActivateAdminProduct({ ...base, variants: [] }), false);
});
