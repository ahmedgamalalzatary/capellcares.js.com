import assert from "node:assert/strict";
import test from "node:test";

import * as schema from "../drizzle/schema.js";

test("exports announcement bar settings and item schema", () => {
  const tables = schema as unknown as Record<string, Record<string, { name?: string }>>;

  assert.equal(tables.announcementBarSettings?.isEnabled?.name, "is_enabled");
  assert.equal(tables.announcementItems?.arText?.name, "ar_text");
  assert.equal(tables.announcementItems?.enText?.name, "en_text");
  assert.equal(tables.announcementItems?.isActive?.name, "is_active");
  assert.equal(tables.announcementItems?.sortOrder?.name, "sort_order");
});
