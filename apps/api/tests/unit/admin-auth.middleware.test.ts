import assert from "node:assert/strict";
import test from "node:test";

import {
  isDevAdminFallbackEnabled,
  resolveDevAdminCredentials
} from "../../src/middlewares/admin-auth.config.js";

test("resolveDevAdminCredentials prefers DEV_ADMIN_* variables", () => {
  const creds = resolveDevAdminCredentials({
    DEV_ADMIN_EMAIL: "dev@example.com",
    DEV_ADMIN_PASSWORD: "dev-pass",
    ADMIN_DEV_EMAIL: "legacy@example.com",
    ADMIN_DEV_PASSWORD: "legacy-pass"
  });

  assert.equal(creds.email, "dev@example.com");
  assert.equal(creds.password, "dev-pass");
});

test("resolveDevAdminCredentials falls back to legacy ADMIN_DEV_* names", () => {
  const creds = resolveDevAdminCredentials({
    ADMIN_DEV_EMAIL: "legacy@example.com",
    ADMIN_DEV_PASSWORD: "legacy-pass"
  });

  assert.equal(creds.email, "legacy@example.com");
  assert.equal(creds.password, "legacy-pass");
});

test("resolveDevAdminCredentials does not use hardcoded dev credentials when env is missing", () => {
  const creds = resolveDevAdminCredentials({});

  assert.equal(creds.email, undefined);
  assert.equal(creds.password, undefined);
});

test("isDevAdminFallbackEnabled respects ALLOW_DEV_ADMIN_FALLBACK flag", () => {
  assert.equal(isDevAdminFallbackEnabled({ ALLOW_DEV_ADMIN_FALLBACK: "true" }), true);
  assert.equal(isDevAdminFallbackEnabled({ ALLOW_DEV_ADMIN_FALLBACK: "1" }), true);
  assert.equal(isDevAdminFallbackEnabled({ ALLOW_DEV_ADMIN_FALLBACK: "false" }), false);
  assert.equal(isDevAdminFallbackEnabled({ ALLOW_DEV_ADMIN_FALLBACK: "0" }), false);
});
