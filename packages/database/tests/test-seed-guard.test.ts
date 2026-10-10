import assert from "node:assert/strict";
import test, { after } from "node:test";

import { clearTestSeed } from "./helpers/test-seed.js";

/** `clearTestSeed` truncates every seeded table, so a misconfigured connection would destroy real data.
 * The guard is asserted by pointing the resolved URL at a production-looking schema; the pool was created from the real test URL at import time, so nothing here touches a live connection. */

const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;

after(() => {
  if (originalTestDatabaseUrl === undefined) {
    Reflect.deleteProperty(process.env, "TEST_DATABASE_URL");
  } else {
    process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
  }
});

test("clearTestSeed refuses to run against a production-named schema", async () => {
  process.env.NODE_ENV = "test";
  process.env.TEST_DATABASE_URL = "mysql://root:pass@localhost:3306/capella";

  await assert.rejects(clearTestSeed(), /Refusing to run destructive test setup/);
});

test("clearTestSeed proceeds against an explicitly disposable schema", async () => {
  process.env.NODE_ENV = "test";
  process.env.TEST_DATABASE_URL = "mysql://root:pass@localhost:3306/capella_test";

  // No rejection: the guard permits this target, so the real reset runs against the live pool (which was connected to the actual test schema at import time).
  await clearTestSeed();
});
