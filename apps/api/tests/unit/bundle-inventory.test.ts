import assert from "node:assert/strict";
import test from "node:test";

import { computeBundleInventoryFromMap } from "../../src/modules/inventory/bundle-inventory.js";

const variantMap = new Map([
  [1, { sellingPrice: "10.00", stockQty: 20 }],
  [2, { sellingPrice: "5.50", stockQty: 9 }]
]);

test("computeBundleInventoryFromMap returns zeros for an empty bundle", () => {
  assert.deepEqual(computeBundleInventoryFromMap([], variantMap), { originalTotal: 0, stock: 0 });
});

test("computeBundleInventoryFromMap sums price*qty and uses the limiting variant for stock", () => {
  const result = computeBundleInventoryFromMap(
    [
      { variantId: 1, qty: 2 },
      { variantId: 2, qty: 3 }
    ],
    variantMap
  );
  // originalTotal: 10*2 + 5.5*3 = 36.5
  assert.equal(result.originalTotal, 36.5);
  // bundles available: floor(20/2)=10, floor(9/3)=3 -> min 3
  assert.equal(result.stock, 3);
});

test("computeBundleInventoryFromMap treats qty <= 0 as zero stock instead of dividing", () => {
  const result = computeBundleInventoryFromMap([{ variantId: 1, qty: 0 }], variantMap);
  assert.equal(result.stock, 0);
});

test("computeBundleInventoryFromMap treats missing variants as zero price and stock", () => {
  const result = computeBundleInventoryFromMap([{ variantId: 999, qty: 1 }], variantMap);
  assert.deepEqual(result, { originalTotal: 0, stock: 0 });
});
