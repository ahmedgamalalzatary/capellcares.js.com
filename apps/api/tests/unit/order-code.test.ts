import assert from "node:assert/strict";
import test from "node:test";

import { generatePendingOrderCode } from "../../src/repositories/order/shared.js";

test("generatePendingOrderCode returns a non-empty provisional order code", () => {
  const pendingCode = generatePendingOrderCode();
  assert.equal(typeof pendingCode, "string");
  assert.notEqual(pendingCode, "");
});

test("generatePendingOrderCode produces distinct values across consecutive calls", () => {
  const first = generatePendingOrderCode();
  const second = generatePendingOrderCode();

  assert.notEqual(first, second);
});
