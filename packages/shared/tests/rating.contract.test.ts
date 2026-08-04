import assert from "node:assert/strict";
import test from "node:test";

import { storefrontRatingContract } from "./contracts/rating.contract.js";

test("reviewed ratings require an average of at least one", () => {
  const result = storefrontRatingContract.safeParse({ average: 0, count: 1 });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.issues[0]?.message, "An unreviewed entity must report a zero average");
    assert.deepEqual(result.error.issues[0]?.path, ["average"]);
  }
});

test("unreviewed and valid reviewed ratings satisfy the contract", () => {
  assert.equal(storefrontRatingContract.safeParse({ average: 0, count: 0 }).success, true);
  assert.equal(storefrontRatingContract.safeParse({ average: 1, count: 1 }).success, true);
});
