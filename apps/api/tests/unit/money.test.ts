import assert from "node:assert/strict";
import test from "node:test";

import { addMoney, multiplyMoney } from "../../src/modules/orders/money.js";

test("multiplyMoney returns exact decimal products using minor-unit arithmetic", () => {
  assert.equal(multiplyMoney(19.99, 3), 59.97);
  assert.equal(multiplyMoney(0.1, 3), 0.3);
});

test("addMoney returns exact decimal sums using minor-unit arithmetic", () => {
  assert.equal(addMoney(0.1, 0.2), 0.3);
  assert.equal(addMoney(59.97, 10), 69.97);
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
