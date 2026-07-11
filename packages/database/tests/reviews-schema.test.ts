import assert from "node:assert/strict";
import test from "node:test";

import { mysqlPool } from "../src/db.js";

test("review content and permanent submission ledger tables exist", async () => {
  const [rows] = await mysqlPool.query<Array<{ tableName: string }>>(
    `select table_name as tableName
       from information_schema.tables
      where table_schema = database()
        and table_name in ('reviews', 'review_submissions')`
  );

  assert.deepEqual(rows.map((row) => row.tableName).sort(), ["review_submissions", "reviews"]);
});

test.after(async () => {
  await mysqlPool.end();
});
