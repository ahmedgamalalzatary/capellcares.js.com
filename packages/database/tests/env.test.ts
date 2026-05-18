import assert from "node:assert/strict";
import test from "node:test";

import { resolveDatabaseUrl } from "../src/env.js";

test("resolveDatabaseUrl prefers TEST_DATABASE_URL when NODE_ENV is test", () => {
  const databaseUrl = resolveDatabaseUrl({
    NODE_ENV: "test",
    DATABASE_URL: "mysql://root:pass@localhost:3306/capella",
    TEST_DATABASE_URL: "mysql://root:pass@localhost:3306/capella_test"
  });

  assert.equal(databaseUrl, "mysql://root:pass@localhost:3306/capella_test");
});

test("resolveDatabaseUrl falls back to DATABASE_URL outside tests", () => {
  const databaseUrl = resolveDatabaseUrl({
    NODE_ENV: "development",
    DATABASE_URL: "mysql://root:pass@localhost:3306/capella"
  });

  assert.equal(databaseUrl, "mysql://root:pass@localhost:3306/capella");
});

test("resolveDatabaseUrl throws when no database url is configured", () => {
  assert.throws(() => resolveDatabaseUrl({ NODE_ENV: "test" }), /DATABASE_URL|TEST_DATABASE_URL/i);
});
