import assert from "node:assert/strict";
import test from "node:test";

import * as shared from "../src/index.js";

test("announcement bar schema accepts the bilingual ordered contract", () => {
  const schema = (shared as Record<string, unknown>).announcementBarSchema as {
    safeParse?: (input: unknown) => { success: boolean };
  } | undefined;

  assert.equal(typeof schema?.safeParse, "function");
  assert.equal(schema?.safeParse?.({
    enabled: true,
    items: [{
      id: 1,
      text: { ar: "عرض", en: "Offer" },
      isActive: true,
      sortOrder: 0
    }]
  }).success, true);
});

test("announcement bar schema rejects blank translations and negative ordering", () => {
  const schema = (shared as Record<string, unknown>).announcementBarSchema as {
    safeParse?: (input: unknown) => { success: boolean };
  } | undefined;

  assert.equal(typeof schema?.safeParse, "function");
  assert.equal(schema?.safeParse?.({
    enabled: true,
    items: [{
      id: 1,
      text: { ar: " ", en: "Offer" },
      isActive: true,
      sortOrder: -1
    }]
  }).success, false);
});
