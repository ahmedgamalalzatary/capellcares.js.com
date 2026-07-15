import assert from "node:assert/strict";
import test from "node:test";

import * as productShared from "../../src/repositories/product/shared.js";

const { mapVariant } = productShared;

test("maps a sellable size and color combination without duplicating option values", () => {
  const mapped = mapVariant({
    id: 3,
    productId: 10,
    sizeId: 1,
    colorId: 2,
    sellingPrice: "25.50",
    stockQty: 4,
    sortOrder: 1
  });

  assert.deepEqual(mapped, {
    id: 3,
    productId: 10,
    sizeId: 1,
    colorId: 2,
    price: 25.5,
    stock: 4,
    sortOrder: 1
  });
});

test("maps product option rows to the public contract", () => {
  const helpers = productShared as unknown as {
    mapSize?: (row: unknown) => unknown;
    mapColor?: (row: unknown) => unknown;
  };
  assert.equal(typeof helpers.mapSize, "function");
  assert.equal(typeof helpers.mapColor, "function");
  assert.deepEqual(helpers.mapSize!({ id: 1, productId: 10, sizeLabel: "100ml", sortOrder: 1 }), {
    id: 1,
    productId: 10,
    label: "100ml",
    sortOrder: 1
  });
  assert.deepEqual(helpers.mapColor!({ id: 2, productId: 10, colorHex: "#FFFFFF", sortOrder: 1 }), {
    id: 2,
    productId: 10,
    hex: "#FFFFFF",
    sortOrder: 1
  });
});
