import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDisposableTestDatabaseUrl,
  databaseNameFromUrl,
  isDisposableTestDatabaseUrl,
  resolveDatabaseUrl
} from "../src/env.js";

/**
 * Test setup truncates and re-seeds every table, so pointing it at a real
 * database would destroy it. These cases lock the rule that a destructive run
 * only proceeds against an explicitly disposable schema.
 */

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

test("databaseNameFromUrl reads the schema name and ignores a query string", () => {
  assert.equal(databaseNameFromUrl("mysql://root:pass@localhost:3306/capella_test"), "capella_test");
  assert.equal(databaseNameFromUrl("mysql://root:pass@localhost:3306/capella?ssl=true"), "capella");
});

test("a test-mode schema name is accepted as a disposable target", () => {
  for (const name of ["capella_test", "capella-test", "capella_test_2", "test_capella", "testing"]) {
    assert.equal(
      isDisposableTestDatabaseUrl(`mysql://root:pass@localhost:3306/${name}`),
      true,
      `${name} must be recognized as disposable`
    );
  }
});

test("a production-looking schema name is refused as a destructive target", () => {
  for (const name of ["capella", "production", "latest", "contest"]) {
    assert.equal(
      isDisposableTestDatabaseUrl(`mysql://root:pass@localhost:3306/${name}`),
      false,
      `${name} must not be treated as disposable`
    );
    assert.throws(
      () => assertDisposableTestDatabaseUrl(`mysql://root:pass@localhost:3306/${name}`),
      /Refusing to run destructive test setup/,
      `${name} must abort a destructive run`
    );
  }
});

test("assertDisposableTestDatabaseUrl names the offending schema in its error", () => {
  assert.throws(
    () => assertDisposableTestDatabaseUrl("mysql://root:pass@localhost:3306/capella"),
    /"capella".*capella_test/s
  );
});

test("assertDisposableTestDatabaseUrl passes silently for a disposable target", () => {
  assert.doesNotThrow(() => assertDisposableTestDatabaseUrl("mysql://root:pass@localhost:3306/capella_test"));
});
