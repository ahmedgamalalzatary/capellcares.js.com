import assert from "node:assert/strict";
import test from "node:test";

import { resolveSecret } from "../../src/config/secrets.js";

test("resolveSecret returns the configured value when present", () => {
  const value = resolveSecret("JWT_ACCESS_SECRET", {
    value: "real-secret",
    devFallback: "dev-access-secret",
    env: { NODE_ENV: "production" }
  });
  assert.equal(value, "real-secret");
});

test("resolveSecret falls back to the dev value outside production", () => {
  const value = resolveSecret("JWT_ACCESS_SECRET", {
    value: undefined,
    devFallback: "dev-access-secret",
    env: { NODE_ENV: "development" }
  });
  assert.equal(value, "dev-access-secret");
});

test("resolveSecret throws when the value is missing in production", () => {
  assert.throws(
    () =>
      resolveSecret("JWT_ACCESS_SECRET", {
        value: undefined,
        devFallback: "dev-access-secret",
        env: { NODE_ENV: "production" }
      }),
    /JWT_ACCESS_SECRET/
  );
});

test("resolveSecret treats an empty string as missing", () => {
  assert.throws(
    () =>
      resolveSecret("JWT_ACCESS_SECRET", {
        value: "",
        devFallback: "dev-access-secret",
        env: { NODE_ENV: "production" }
      }),
    /JWT_ACCESS_SECRET/
  );
});
