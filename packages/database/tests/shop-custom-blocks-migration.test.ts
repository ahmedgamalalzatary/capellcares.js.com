import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(import.meta.dirname, "../drizzle/migrations/0076_shop_custom_blocks.sql"),
  "utf8"
);

const statements = migrationSql.split("--> statement-breakpoint").map((statement) => statement.trim());

test("shop custom blocks migration turns picture slots 2 to 5 that have pictures into custom sections, in slot order", () => {
  const insert = statements.find((statement) => statement.startsWith("INSERT INTO `shop_custom_blocks`"));
  assert.ok(insert, "expected the old picture slots to be copied into custom sections");
  assert.match(insert, /'media'/);
  assert.match(insert, /`slot` IN \(2, 3, 4, 5\)/);
  assert.match(insert, /EXISTS \(SELECT 1 FROM `shop_media_section_items`/);
  assert.match(insert, /`slot`/);
});

test("shop custom blocks migration drops empty old slots and frees the rest from their slot numbers", () => {
  const insertIndex = statements.findIndex((statement) => statement.startsWith("INSERT INTO `shop_custom_blocks`"));
  const deleteIndex = statements.findIndex((statement) => statement.startsWith("DELETE FROM `shop_media_sections`"));
  const freeIndex = statements.findIndex((statement) => statement.startsWith("UPDATE `shop_media_sections` SET `slot` = NULL"));
  const nullableIndex = statements.findIndex((statement) => statement.includes("MODIFY COLUMN `slot` int;"));

  assert.ok(deleteIndex !== -1, "expected empty old slots to be removed");
  assert.ok(freeIndex !== -1, "expected moved slots to lose their slot number");
  assert.match(statements[deleteIndex], /NOT EXISTS/);
  assert.ok(nullableIndex < freeIndex, "slot must accept NULL before it is cleared");
  assert.ok(insertIndex < deleteIndex && insertIndex < freeIndex, "pictures must be copied before the old slots change");
});
