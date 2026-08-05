import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(import.meta.dirname, "../drizzle/migrations/0029_localized_shop_media.sql"),
  "utf8"
);

test("localized shop-media migration moves legacy images to English and leaves Arabic empty", () => {
  const dataMigration = migrationSql.match(
    /UPDATE `shop_media_section_items`[\s\S]+?;(?=\s*--> statement-breakpoint)/
  )?.[0];

  assert.ok(dataMigration, "expected a shop-media data migration statement");
  assert.match(dataMigration, /`en_image_path`\s*=\s*`image_path`/);
  assert.match(dataMigration, /`en_mobile_image_path`\s*=\s*`mobile_image_path`/);
  assert.doesNotMatch(dataMigration, /`ar_image_path`\s*=/);
  assert.doesNotMatch(dataMigration, /`ar_mobile_image_path`\s*=/);
});

test("localized shop-media migration removes the two legacy columns after copying them", () => {
  assert.match(migrationSql, /DROP COLUMN `image_path`/);
  assert.match(migrationSql, /DROP COLUMN `mobile_image_path`/);

  const updateIndex = migrationSql.indexOf("UPDATE `shop_media_section_items`");
  const dropImageIndex = migrationSql.indexOf("DROP COLUMN `image_path`");
  const dropMobileImageIndex = migrationSql.indexOf("DROP COLUMN `mobile_image_path`");

  assert.ok(updateIndex !== -1 && updateIndex < dropImageIndex, "expected legacy images to be copied before dropping image_path");
  assert.ok(updateIndex !== -1 && updateIndex < dropMobileImageIndex, "expected legacy images to be copied before dropping mobile_image_path");
});
