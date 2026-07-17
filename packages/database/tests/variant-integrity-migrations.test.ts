import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readMigration(name: string) {
  return readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), "utf8");
}

test("repairs historical negative stock before adding the stock constraint", async () => {
  const migration = await readMigration("0018_variant_stock_integrity.sql");
  assert.match(migration, /UPDATE `product_variants` SET `stock_qty` = 0 WHERE `stock_qty` < 0/i);
  assert.match(migration, /UPDATE[\s\S]*--> statement-breakpoint[\s\S]*ALTER TABLE/i);
});

test("allows the price constraint to reject historical negative prices", async () => {
  const migration = await readMigration("0019_variant_price_integrity.sql");
  assert.doesNotMatch(migration, /UPDATE\s+`product_variants`/i);
  assert.match(migration, /CHECK \(`selling_price` >= 0\)/i);
});

test("normalizes existing colors before installing the canonical hex check", async () => {
  const migration = await readMigration("0020_canonical_color_hex.sql");
  assert.match(migration, /UPDATE `product_colors` SET `color_hex` = UPPER\(`color_hex`\)/i);
  assert.ok(migration.indexOf("UPDATE") < migration.indexOf("ALTER TABLE"));
});

test("uses case-sensitive canonical color checks", async () => {
  const migration = await readMigration("0016_product_options.sql");
  assert.match(migration, /BINARY `color_hex` = BINARY UPPER\(`color_hex`\)/i);
});

test("backfills null legacy size labels and assigns every variant", async () => {
  const migration = await readMigration("0017_variant_option_references.sql");
  assert.match(migration, /COALESCE\(`size_label`,\s*'[^']+'\)/i);
  assert.match(migration, /<=>/);
  assert.match(migration, /null_size_collision_guard/i);
});
