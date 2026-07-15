import assert from "node:assert/strict";
import test from "node:test";

import * as schema from "../drizzle/schema.js";

test("exports size, color, and sellable combination schema", () => {
  const tables = schema as unknown as Record<string, Record<string, { name?: string }>>;

  assert.equal(tables.productSizes?.sizeLabel?.name, "size_label");
  assert.equal(tables.productColors?.colorHex?.name, "color_hex");
  assert.equal(tables.productVariants?.sizeId?.name, "size_id");
  assert.equal(tables.productVariants?.colorId?.name, "color_id");
  assert.equal(tables.orderItems?.snapshotColorHex?.name, "snapshot_color_hex");
  assert.equal(tables.productVariants?.sizeLabel, undefined);
});
