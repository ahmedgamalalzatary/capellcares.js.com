import assert from "node:assert/strict";
import test from "node:test";

import { addMoney, multiplyMoney } from "../../src/modules/orders/money.js";

test("multiplyMoney returns exact decimal products using fils (3-digit) arithmetic", () => {
  assert.equal(multiplyMoney(19.99, 3), 59.97);
  assert.equal(multiplyMoney(0.1, 3), 0.3);
  assert.equal(multiplyMoney(1.125, 3), 3.375);
});

test("addMoney returns exact decimal sums using fils (3-digit) arithmetic", () => {
  assert.equal(addMoney(0.1, 0.2), 0.3);
  assert.equal(addMoney(59.97, 10), 69.97);
  assert.equal(addMoney(0.001, 0.002), 0.003);
});

test("multiplyMoney rejects non-integer quantities", () => {
  assert.throws(() => multiplyMoney(19.99, 1.5), /quantity/i);
});

test("money helpers reject non-finite and negative values", () => {
  assert.throws(() => multiplyMoney(Number.NaN, 1), /amount/i);
  assert.throws(() => multiplyMoney(10, Number.POSITIVE_INFINITY), /quantity/i);
  assert.throws(() => multiplyMoney(10, -1), /quantity/i);
  assert.throws(() => addMoney(-0.01, 1), /left/i);
  assert.throws(() => addMoney(1, Number.NaN), /right/i);
});
