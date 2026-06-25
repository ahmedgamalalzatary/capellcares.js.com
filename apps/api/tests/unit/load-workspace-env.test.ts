import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import test from "node:test";

import { loadWorkspaceEnv } from "../../src/config/env.js";

test("loadWorkspaceEnv loads .env.test from workspace root and maps TEST_DATABASE_URL during tests", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "capella-env-test-"));
  const apiDir = join(tempRoot, "apps", "api");
  const envPath = join(tempRoot, ".env.test");

  try {
    writeFileSync(envPath, "TEST_DATABASE_URL=mysql://root:pass@localhost:3306/minikoshk_test\n");

    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test"
    };
    const loadedPaths: string[] = [];
    const normalizedApiDir = apiDir.split("\\").join(sep);

    loadWorkspaceEnv({
      cwd: normalizedApiDir,
      env,
      fileExists: (path) => path === envPath,
      loadFile: (path) => {
        loadedPaths.push(path);
        env.TEST_DATABASE_URL = "mysql://root:pass@localhost:3306/minikoshk_test";
      }
    });

    assert.deepEqual(loadedPaths, [envPath]);
    assert.equal(env.TEST_DATABASE_URL, "mysql://root:pass@localhost:3306/minikoshk_test");
    assert.equal(env.DATABASE_URL, "mysql://root:pass@localhost:3306/minikoshk_test");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("loadWorkspaceEnv maps TEST_DATABASE_URL during tests even without .env.test", () => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    TEST_DATABASE_URL: "mysql://root:pass@localhost:3306/minikoshk_test"
  };

  let loaderCalled = false;
  loadWorkspaceEnv({
    cwd: "D:/workspace/apps/api",
    env,
    fileExists: () => false,
    loadFile: () => {
      loaderCalled = true;
    }
  });

  assert.equal(loaderCalled, false);
  assert.equal(env.DATABASE_URL, "mysql://root:pass@localhost:3306/minikoshk_test");
});

test("loadWorkspaceEnv skips loading when DATABASE_URL already exists", () => {
  const env: NodeJS.ProcessEnv = {
    DATABASE_URL: "mysql://already-set"
  };

  let loaderCalled = false;
  loadWorkspaceEnv({
    cwd: "D:/workspace/apps/api",
    env,
    fileExists: () => true,
    loadFile: () => {
      loaderCalled = true;
    }
  });

  assert.equal(loaderCalled, false);
});
