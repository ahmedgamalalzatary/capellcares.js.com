import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationsDir = resolve(import.meta.dirname, "../drizzle/migrations");
const schemaPath = resolve(import.meta.dirname, "../drizzle/schema.ts");

const HOVER_IMAGE_TABLES = ["products", "offers", "collections"];

function readMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({
      name,
      sql: readFileSync(resolve(migrationsDir, name), "utf8")
    }));
}

test("a migration adds the product hover-image columns to offers and collections", () => {
  const added = new Set<string>();
  for (const migration of readMigrationFiles()) {
    for (const match of migration.sql.matchAll(/ALTER TABLE `(\w+)`\s+ADD `(\w+)` varchar\(1024\)/g)) {
      added.add(`${match[1]}:${match[2]}`);
    }
  }

  for (const table of HOVER_IMAGE_TABLES) {
    assert.ok(
      added.has(`${table}:hover_image_path`),
      `expected a migration adding hover_image_path to ${table}`
    );
    assert.ok(
      added.has(`${table}:ar_hover_image_path`),
      `expected a migration adding ar_hover_image_path to ${table}`
    );
  }
});

test("schema declares the hover-image columns once per purchasable entity", () => {
  const schemaSource = readFileSync(schemaPath, "utf8");
  assert.equal(
    [...schemaSource.matchAll(/hoverImagePath: varchar\("hover_image_path"/g)].length,
    3,
    "expected hover_image_path on products, offers and collections"
  );
  assert.equal(
    [...schemaSource.matchAll(/arHoverImagePath: varchar\("ar_hover_image_path"/g)].length,
    3,
    "expected ar_hover_image_path on products, offers and collections"
  );
});
