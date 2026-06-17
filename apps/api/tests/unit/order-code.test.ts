import assert from "node:assert/strict";
import test from "node:test";

import { formatDailyOrderCode, generatePendingOrderCode } from "../../src/repositories/order/shared.js";

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

test("formatDailyOrderCode formats channel, timestamp, and daily counter", () => {
  const code = formatDailyOrderCode("ERP", new Date(2026, 5, 18, 14, 7, 30), 3);

  assert.equal(code, "ERP-2026-06-18-14-07-3");
});
