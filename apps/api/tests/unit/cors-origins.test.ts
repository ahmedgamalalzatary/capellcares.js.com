import assert from "node:assert/strict";
import test from "node:test";

import { resolveAllowedOrigins } from "../../src/config/cors.js";

test("resolveAllowedOrigins parses a comma-separated allowlist", () => {
  const origins = resolveAllowedOrigins({
    CORS_ALLOWED_ORIGINS: "https://erp.minikoshk.test, https://shop.minikoshk.test",
    NODE_ENV: "production"
  });
  assert.deepEqual(origins, ["https://erp.minikoshk.test", "https://shop.minikoshk.test"]);
});

test("resolveAllowedOrigins falls back to localhost defaults outside production", () => {
  const origins = resolveAllowedOrigins({ NODE_ENV: "development" });
  assert.ok(origins.includes("http://localhost:3000"));
  assert.ok(origins.includes("http://localhost:3001"));
});

test("resolveAllowedOrigins throws when no allowlist is configured in production", () => {
  assert.throws(() => resolveAllowedOrigins({ NODE_ENV: "production" }), /CORS_ALLOWED_ORIGINS/);
});
