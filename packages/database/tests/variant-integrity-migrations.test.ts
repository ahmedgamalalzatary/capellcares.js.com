import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readMigration(name: string) {
  return readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), "utf8");
}

test("repairs historical negative stock before adding the stock constraint", async () => {
  const migration = await readMigration("0018_variant_stock_integrity.sql");
  assert.match(migration, /UPDATE `product_variants` SET `stock_qty` = 0 WHERE `stock_qty` < 0/i);
  assert.ok(migration.indexOf("UPDATE") < migration.indexOf("ALTER TABLE"));
});

test("repairs historical negative prices before adding the price constraint", async () => {
  const migration = await readMigration("0019_variant_price_integrity.sql");
  assert.match(migration, /UPDATE `product_variants` SET `selling_price` = 0 WHERE `selling_price` < 0/i);
  assert.ok(migration.indexOf("UPDATE") < migration.indexOf("ALTER TABLE"));
});
