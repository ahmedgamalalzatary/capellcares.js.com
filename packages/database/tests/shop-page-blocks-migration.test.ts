import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(import.meta.dirname, "../drizzle/migrations/0068_shop_page_blocks.sql"),
  "utf8"
);

const statements = migrationSql.split("--> statement-breakpoint").map((statement) => statement.trim());
const indexOf = (prefix: string) => statements.findIndex((statement) => statement.startsWith(prefix));

test("shop page blocks migration lays out today's shop page: banner, category tiles, offers, picture 2, collections, picture 3, bestsellers, picture 4, new, picture 5", () => {
  const insert = statements.find((statement) => statement.startsWith("INSERT INTO `shop_page_blocks`"));
  assert.ok(insert, "expected the current layout to be written into shop_page_blocks");

  // Built-in sections sit between the old picture slots, so slot n takes position 2n - 1 and the built-ins the even places around them.
  for (const [type, position] of [["category_tiles", 2], ["offers", 3], ["collections", 5], ["bestsellers", 7], ["new", 9]] as const) {
    assert.match(insert, new RegExp(`'${type}', '${type}', NULL, NULL, ${position}`), `${type} at ${position}`);
  }
  assert.match(insert, /'media', CONCAT\('media:', `id`\), NULL, `id`, CASE `slot` WHEN 1 THEN 1 WHEN 2 THEN 4 WHEN 3 THEN 6 WHEN 4 THEN 8 WHEN 5 THEN 10 END/);
  assert.match(insert, /EXISTS \(SELECT 1 FROM `shop_media_section_items`/);
});

test("shop page blocks migration drops picture slots with no pictures, and only then removes the slot column", () => {
  const insertIndex = indexOf("INSERT INTO `shop_page_blocks`");
  const deleteIndex = indexOf("DELETE FROM `shop_media_sections`");
  const dropSlotIndex = statements.findIndex((statement) => statement.includes("DROP COLUMN `slot`"));

  assert.ok(deleteIndex !== -1, "expected empty picture slots to be removed");
  assert.match(statements[deleteIndex]!, /NOT EXISTS \(SELECT 1 FROM `shop_media_section_items`/);
  assert.ok(insertIndex !== -1 && insertIndex < deleteIndex, "pictures must be placed before the empty slots go");
  assert.ok(deleteIndex < dropSlotIndex, "the slot order must be read before the column is dropped");
});
