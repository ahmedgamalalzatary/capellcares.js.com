import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(import.meta.dirname, "../drizzle/migrations/0077_shop_page_blocks.sql"),
  "utf8"
);

const statements = migrationSql.split("--> statement-breakpoint").map((statement) => statement.trim());
const indexOf = (prefix: string) => statements.findIndex((statement) => statement.startsWith(prefix));

test("shop page blocks migration lays out today's shop page: banner, genders, category tiles, bestsellers, custom sections, new, offers, brands", () => {
  const insert = statements.find((statement) => statement.startsWith("INSERT INTO `shop_page_blocks`"));
  assert.ok(insert, "expected the current layout to be written into shop_page_blocks");

  assert.match(insert, /'media', CONCAT\('media:', `id`\), NULL, `id`, 1\s+FROM `shop_media_sections`\s+WHERE `slot` = 1 AND EXISTS \(SELECT 1 FROM `shop_media_section_items`/);
  for (const [type, position] of [["genders", 2], ["category_tiles", 3], ["bestsellers", 4]] as const) {
    assert.match(insert, new RegExp(`'${type}', '${type}', NULL, NULL, ${position}\\b`), `${type} at ${position}`);
  }
  // The custom sections keep their order right after bestsellers; new, offers and brands follow them.
  assert.match(insert, /4 \+ ROW_NUMBER\(\) OVER \(ORDER BY `sort_order`, `id`\)\s+FROM `shop_custom_blocks`/);
  for (const [type, offset] of [["new", 5], ["offers", 6], ["brands", 7]] as const) {
    assert.match(insert, new RegExp(`'${type}', '${type}', NULL, NULL, \\(SELECT COUNT\\(\\*\\) FROM \`shop_custom_blocks\`\\) \\+ ${offset}`), `${type} after the custom sections`);
  }
});

test("shop page blocks migration drops an empty top banner, and only then removes the slot column", () => {
  const insertIndex = indexOf("INSERT INTO `shop_page_blocks`");
  const deleteIndex = indexOf("DELETE FROM `shop_media_sections`");
  const dropSlotIndex = statements.findIndex((statement) => statement.includes("DROP COLUMN `slot`"));

  assert.ok(deleteIndex !== -1, "expected an empty top banner to be removed");
  assert.match(statements[deleteIndex]!, /`slot` = 1 AND NOT EXISTS \(SELECT 1 FROM `shop_media_section_items`/);
  assert.ok(insertIndex !== -1 && insertIndex < deleteIndex, "the banner must be placed before an empty one goes");
  assert.ok(deleteIndex < dropSlotIndex, "the slot must be read before the column is dropped");
});

test("the old custom sections table is dropped only after the layout was copied from it", () => {
  const dropSql = readFileSync(
    resolve(import.meta.dirname, "../drizzle/migrations/0078_drop_shop_custom_blocks.sql"),
    "utf8"
  );
  assert.match(dropSql, /DROP TABLE `shop_custom_blocks`/);
});
