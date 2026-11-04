import assert from "node:assert/strict";
import test from "node:test";

import { computeDeliveryFee } from "../../src/modules/delivery/delivery-fee.js";

// Area 2 costs 15; product 1 has no own fee, products 2 and 4 cost 10 each.
const area = 15;
const p1 = { productId: 1, ownFee: null };
const p2 = { productId: 2, ownFee: 10 };
const p3 = { productId: 3, ownFee: 0 };
const p4 = { productId: 4, ownFee: 10 };

test("a product without its own fee pays the area fee", () => {
  assert.equal(computeDeliveryFee(area, [p1]), 15);
});

test("an own fee of 0 means the area fee, same as empty", () => {
  assert.equal(computeDeliveryFee(area, [p3]), 15);
});

test("a product with its own fee pays only that fee", () => {
  assert.equal(computeDeliveryFee(area, [p2]), 10);
  assert.equal(computeDeliveryFee(0, [p2]), 10);
});

test("products without own fees share one area fee", () => {
  assert.equal(computeDeliveryFee(area, [p1, p3]), 15);
});

test("a mixed cart adds the area fee once and each own fee", () => {
  assert.equal(computeDeliveryFee(area, [p1, p2]), 25);
  assert.equal(computeDeliveryFee(area, [p2, p4]), 20);
});

test("several lines of the same product (sizes, colours) pay its fee once", () => {
  assert.equal(computeDeliveryFee(area, [p2, { ...p2 }]), 10);
});

test("offers and collections use the area fee", () => {
  assert.equal(computeDeliveryFee(area, [{ productId: null, ownFee: null }]), 15);
  assert.equal(computeDeliveryFee(area, [{ productId: null, ownFee: null }, p2]), 25);
});

test("fees keep fils exactly", () => {
  assert.equal(computeDeliveryFee(0.1, [p1, { productId: 9, ownFee: 0.2 }]), 0.3);
});

test("an empty cart has no delivery fee", () => {
  assert.equal(computeDeliveryFee(area, []), 0);
});
