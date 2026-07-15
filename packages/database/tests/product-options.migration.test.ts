import assert from "node:assert/strict";
import test from "node:test";

import { mysqlPool } from "../src/db.js";

test("creates product_sizes and product_colors option tables", async () => {
  const [rows] = await mysqlPool.query<Array<{ tableName: string }>>(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN ('product_sizes', 'product_colors')`
  );

  assert.deepEqual(
    rows.map((row) => row.tableName).sort(),
    ["product_colors", "product_sizes"]
  );
});

test("moves sellable variants to size and optional color references", async () => {
  const [rows] = await mysqlPool.query<Array<{
    columnName: string;
    nullable: "YES" | "NO";
  }>>(
    `SELECT column_name AS columnName, is_nullable AS nullable
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'product_variants'
        AND column_name IN ('size_id', 'color_id', 'size_label', 'active_size_label')`
  );
  const columns = new Map(rows.map((row) => [row.columnName, row.nullable]));

  assert.equal(columns.get("size_id"), "NO");
  assert.equal(columns.get("color_id"), "YES");
  assert.equal(columns.has("size_label"), false);
  assert.equal(columns.has("active_size_label"), false);
});

test("adds a nullable color snapshot to order items", async () => {
  const [rows] = await mysqlPool.query<Array<{
    columnName: string;
    nullable: "YES" | "NO";
  }>>(
    `SELECT column_name AS columnName, is_nullable AS nullable
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'order_items'
        AND column_name = 'snapshot_color_hex'`
  );

  assert.deepEqual(rows, [{ columnName: "snapshot_color_hex", nullable: "YES" }]);
});

test.after(async () => {
  await mysqlPool.end();
});
