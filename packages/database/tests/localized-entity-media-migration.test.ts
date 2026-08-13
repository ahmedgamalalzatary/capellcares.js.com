import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  import.meta.dirname,
  "../drizzle/migrations/0031_localized_entity_images.sql"
);
const schemaPath = resolve(import.meta.dirname, "../drizzle/schema.ts");

test("localized entity-media migration preserves current images as English", () => {
  assert.equal(existsSync(migrationPath), true, "expected localized entity-media migration");
  if (!existsSync(migrationPath)) return;

  const migrationSql = readFileSync(migrationPath, "utf8");
  assert.match(migrationSql, /ADD `ar_url` varchar\(1024\)/);
  assert.doesNotMatch(migrationSql, /UPDATE `entity_media`[\s\S]*`ar_url`\s*=/);
});

test("localized entity-media migration adds Arabic product hover images without replacing English", () => {
  assert.equal(existsSync(migrationPath), true, "expected localized entity-media migration");
  if (!existsSync(migrationPath)) return;

  const migrationSql = readFileSync(migrationPath, "utf8");
  assert.match(migrationSql, /ADD `ar_hover_image_path` varchar\(1024\)/);
  assert.doesNotMatch(migrationSql, /DROP COLUMN `hover_image_path`/);
});

test("localized entity-media migration permits either image language while videos keep a URL", () => {
  assert.equal(existsSync(migrationPath), true, "expected localized entity-media migration");
  if (!existsSync(migrationPath)) return;

  const migrationSql = readFileSync(migrationPath, "utf8");
  assert.match(migrationSql, /MODIFY COLUMN `url` varchar\(1024\)(?! NOT NULL)/);
  assert.match(migrationSql, /entity_media_localized_url_check/);
  assert.match(migrationSql, /`media_type` = 'image'[\s\S]*`ar_url` is not null[\s\S]*`url` is not null/i);
  assert.match(migrationSql, /`media_type` = 'video'[\s\S]*`url` is not null/i);
  assert.match(migrationSql, /`ar_url` <> ''/i);
  assert.match(migrationSql, /`url` <> ''/i);
  const schemaSource = readFileSync(schemaPath, "utf8");
  assert.match(schemaSource, /localizedUrlCheck:[\s\S]*arUrl[^\n]*<> ''[\s\S]*url[^\n]*<> ''/);
});
