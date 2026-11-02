import test from "node:test";
import assert from "node:assert/strict";
import { productColorName, variantOptionLabel } from "../src/product-variants.ts";

const black = { id: 7, name: { ar: "أسود", en: "Black" }, hex: "#000000", media: [] };
const unnamed = { id: 8, name: { ar: "", en: "" }, hex: "#ff0000", media: [] };

test("productColorName uses the page language and falls back to the other one", () => {
  assert.equal(productColorName(black, "ar"), "أسود");
  assert.equal(productColorName(black, "en"), "Black");
  assert.equal(productColorName({ ...black, name: { ar: "", en: "Black" } }, "ar"), "Black");
  assert.equal(productColorName(unnamed, "en"), "");
});

test("variantOptionLabel joins size and colour, skipping whichever is missing", () => {
  const colors = [black, unnamed];
  assert.equal(variantOptionLabel({ size: "S", colorId: 7 }, colors, "en"), "S / Black");
  assert.equal(variantOptionLabel({ size: "S", colorId: null }, colors, "en"), "S");
  assert.equal(variantOptionLabel({ size: "", colorId: 7 }, colors, "ar"), "أسود");
  assert.equal(variantOptionLabel({ size: "", colorId: null }, colors, "en"), "");
  assert.equal(variantOptionLabel({ size: "M", colorId: 8 }, colors, "en"), "M");
  assert.equal(variantOptionLabel({ size: "M", colorId: 99 }, colors, "en"), "M");
  assert.equal(variantOptionLabel({ size: "M" }, undefined, "en"), "M");
});
