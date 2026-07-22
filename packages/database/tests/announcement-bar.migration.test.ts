import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mysqlPool } from "../src/db.js";

test("creates announcement bar settings and item tables", async () => {
  const [rows] = await mysqlPool.query<Array<{ tableName: string }>>(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN ('announcement_bar_settings', 'announcement_items')`
  );

  assert.deepEqual(
    rows.map((row) => row.tableName).sort(),
    ["announcement_bar_settings", "announcement_items"]
  );
});

test("migration installs the current announcement copy", async () => {
  const migration = await readFile(
    new URL("../drizzle/migrations/0021_announcement_bar.sql", import.meta.url),
    "utf8"
  );

  assert.match(migration, /INSERT INTO `announcement_bar_settings`/);
  assert.match(migration, /VALUES \(1, true\)/);
  assert.match(migration, /INSERT INTO `announcement_items`/);
  assert.match(migration, /Get 3 Zanooba for 1199 EGP/);
  assert.match(migration, /Any 3 EVA Pieces for only 999 EGP/);
  assert.match(migration, /2nd item -15% \| 3rd item -30% \| Free Shipping 800\+ EGP \| \+15% with Card/);
  assert.match(migration, /Get 3 Classics for 1199 EGP/);
  assert.equal(migration.match(/true, [0-3]\)/g)?.length, 4);
  assert.match(migration, /اشترِ ٣ زنوبة بـ ١١٩٩ جنيه/);
});

test("migration SQL produces the enabled singleton and four ordered bilingual rows", async () => {
  const migration = await readFile(
    new URL("../drizzle/migrations/0021_announcement_bar.sql", import.meta.url),
    "utf8"
  );
  const connection = await mysqlPool.getConnection();

  try {
    for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
      const isolatedStatement = statement
        .replace(/^CREATE TABLE/, "CREATE TEMPORARY TABLE")
        .replace(/CONSTRAINT `[^`]+` /g, "");
      await connection.query(isolatedStatement);
    }

    const [settings] = await connection.query<Array<{ id: number; isEnabled: number }>>(
      "SELECT id, is_enabled AS isEnabled FROM announcement_bar_settings"
    );
    const [items] = await connection.query<Array<{
      arText: string;
      enText: string;
      isActive: number;
      sortOrder: number;
    }>>(
      "SELECT ar_text AS arText, en_text AS enText, is_active AS isActive, sort_order AS sortOrder FROM announcement_items ORDER BY sort_order"
    );

    assert.deepEqual(settings, [{ id: 1, isEnabled: 1 }]);
    assert.deepEqual(items, [
      { arText: "اشترِ ٣ زنوبة بـ ١١٩٩ جنيه", enText: "Get 3 Zanooba for 1199 EGP", isActive: 1, sortOrder: 0 },
      { arText: "أي ٣ قطع EVA بـ ٩٩٩ جنيه فقط", enText: "Any 3 EVA Pieces for only 999 EGP", isActive: 1, sortOrder: 1 },
      {
        arText: "القطعة الثانية -١٥٪ | الثالثة -٣٠٪ | شحن مجاني فوق ٨٠٠ جنيه | +١٥٪ بالبطاقة",
        enText: "2nd item -15% | 3rd item -30% | Free Shipping 800+ EGP | +15% with Card",
        isActive: 1,
        sortOrder: 2
      },
      { arText: "اشترِ ٣ كلاسيك بـ ١١٩٩ جنيه", enText: "Get 3 Classics for 1199 EGP", isActive: 1, sortOrder: 3 }
    ]);
  } finally {
    await connection.query("DROP TEMPORARY TABLE IF EXISTS announcement_items");
    await connection.query("DROP TEMPORARY TABLE IF EXISTS announcement_bar_settings");
    connection.release();
  }
});

test.after(async () => {
  await mysqlPool.end();
});
