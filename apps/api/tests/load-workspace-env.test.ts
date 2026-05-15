import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import test from "node:test";

import { loadWorkspaceEnv } from "../src/config/env.js";

test("loadWorkspaceEnv loads .env from workspace root when DATABASE_URL is missing", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "capella-env-test-"));
  const apiDir = join(tempRoot, "apps", "api");
  const envPath = join(tempRoot, ".env");

  try {
    writeFileSync(envPath, "DATABASE_URL=mysql://root:pass@localhost:3306/capella\n");

    const env: NodeJS.ProcessEnv = {};
    const loadedPaths: string[] = [];
    const normalizedApiDir = apiDir.split("\\").join(sep);

    loadWorkspaceEnv({
      cwd: normalizedApiDir,
      env,
      fileExists: (path) => path === envPath,
      loadFile: (path) => {
        loadedPaths.push(path);
        env.DATABASE_URL = "mysql://root:pass@localhost:3306/capella";
      }
    });

    assert.deepEqual(loadedPaths, [envPath]);
    assert.equal(env.DATABASE_URL, "mysql://root:pass@localhost:3306/capella");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
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
