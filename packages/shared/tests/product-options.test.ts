import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";

import * as productSchemas from "../src/schemas/product.schema.js";

test("normalizes short and lowercase hex colors to canonical uppercase hex", () => {
  const normalizeColorHex = (productSchemas as unknown as {
    normalizeColorHex?: (value: string) => string;
  }).normalizeColorHex;

  assert.equal(typeof normalizeColorHex, "function");
  assert.equal(normalizeColorHex!("#fff"), "#FFFFFF");
  assert.equal(normalizeColorHex!("#a1b2c3"), "#A1B2C3");
});

test("rejects named and malformed colors", () => {
  assert.throws(() => productSchemas.normalizeColorHex("white"), /hex/i);
  assert.throws(() => productSchemas.normalizeColorHex("#FFFF"), /hex/i);
});

test("product schemas model options separately from sellable combinations", () => {
  const schemas = productSchemas as unknown as Record<string, { parse(value: unknown): unknown }>;
  assert.equal(typeof schemas.productSizeSchema?.parse, "function");
  assert.equal(typeof schemas.productColorSchema?.parse, "function");

  assert.deepEqual(schemas.productSizeSchema.parse({
    id: 1,
    productId: 10,
    label: "100ml",
    sortOrder: 1
  }), { id: 1, productId: 10, label: "100ml", sortOrder: 1 });
  assert.deepEqual(schemas.productColorSchema.parse({
    id: 2,
    productId: 10,
    hex: "#fff",
    sortOrder: 1
  }), { id: 2, productId: 10, hex: "#FFFFFF", sortOrder: 1 });
  assert.deepEqual(productSchemas.productVariantSchema.parse({
    id: 3,
    productId: 10,
    sizeId: 1,
    colorId: 2,
    price: 25,
    stock: 4,
    sortOrder: 1
  }), {
    id: 3,
    productId: 10,
    sizeId: 1,
    colorId: 2,
    price: 25,
    stock: 4,
    sortOrder: 1
  });
});

test("product schema includes size and color option collections", () => {
  assert.equal("sizes" in productSchemas.productSchema.shape, true);
  assert.equal("colors" in productSchemas.productSchema.shape, true);
});

test("productColorSchema reports malformed colors as Zod errors", () => {
  assert.throws(() => productSchemas.productColorSchema.parse({
    id: 2,
    productId: 10,
    hex: "white",
    sortOrder: 1
  }), ZodError);
});
