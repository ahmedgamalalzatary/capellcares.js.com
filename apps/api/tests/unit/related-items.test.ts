import assert from "node:assert/strict";
import test from "node:test";

import { isDuplicateEntryError } from "../../src/modules/admin/shared/db-errors.js";
import { parseRelatedItems } from "../../src/modules/admin/shared/related-items.js";

test("parseRelatedItems keeps valid refs and drops invalid types/ids", () => {
  const refs = parseRelatedItems([
    { type: "product", id: 1 },
    { type: "offer", id: "2" },
    { type: "category", id: 3 },
    { type: "collection", id: 0 },
    { type: "product", id: -5 }
  ]);
  assert.deepEqual(refs, [
    { type: "product", id: 1 },
    { type: "offer", id: 2 }
  ]);
});

test("parseRelatedItems deduplicates identical type/id pairs", () => {
  const refs = parseRelatedItems([
    { type: "product", id: 1 },
    { type: "product", id: 1 },
    { type: "offer", id: 1 }
  ]);
  assert.deepEqual(refs, [
    { type: "product", id: 1 },
    { type: "offer", id: 1 }
  ]);
});

test("parseRelatedItems returns empty array for non-array input", () => {
  assert.deepEqual(parseRelatedItems(undefined), []);
  assert.deepEqual(parseRelatedItems(null), []);
  assert.deepEqual(parseRelatedItems("nope"), []);
});

test("isDuplicateEntryError detects mysql duplicate errors in code, cause, and message", () => {
  assert.equal(isDuplicateEntryError({ code: "ER_DUP_ENTRY" }), true);
  assert.equal(isDuplicateEntryError({ cause: { code: "ER_DUP_ENTRY" } }), true);
  assert.equal(isDuplicateEntryError({ message: "Duplicate entry 'x'" }), true);
  assert.equal(isDuplicateEntryError({ cause: { message: "Duplicate entry 'x'" } }), true);
});

test("isDuplicateEntryError returns falsy for unrelated errors", () => {
  assert.ok(!isDuplicateEntryError({ code: "ER_NO_SUCH_TABLE" }));
  assert.ok(!isDuplicateEntryError(new Error("boom")));
  assert.ok(!isDuplicateEntryError(undefined));
});
