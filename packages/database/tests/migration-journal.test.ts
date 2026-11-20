import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

// Drizzle applies only migrations newer than the last one recorded in the database, so a migration whose timestamp
// is earlier than one before it is silently skipped wherever that earlier one already ran.
// Already applied everywhere before this check existed; kept as is because rewriting history would re-run it.
const LEGACY_OUT_OF_ORDER = new Set(["0008_lumpy_rhino"]);

test("migration timestamps increase with their order", () => {
  const journal = JSON.parse(readFileSync(resolve(import.meta.dirname, "../drizzle/migrations/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; when: number; tag: string }> };
  for (let index = 1; index < journal.entries.length; index += 1) {
    const previous = journal.entries[index - 1]!;
    const current = journal.entries[index]!;
    if (LEGACY_OUT_OF_ORDER.has(current.tag)) continue;
    assert.ok(current.when > previous.when, `${current.tag} (${current.when}) must be newer than ${previous.tag} (${previous.when})`);
  }
});
