import assert from "node:assert/strict";
import test from "node:test";
import * as shared from "../src/schemas/index.js";

test("the public policy accepts a prelaunch response and rejects unsupported schema versions", () => {
  const schema = (shared as Record<string, any>).appConfigSchema;
  assert.equal(typeof schema?.safeParse, "function");
  const config = { schemaVersion: 1, policyRevision: "prelaunch-v1", platform: "android",
    cache: { maxAgeSeconds: 0 }, current: null, previous: null, recommendedUpdate: null, features: [] };
  assert.equal(schema.safeParse(config).success, true);
  assert.equal(schema.safeParse({ ...config, schemaVersion: 2 }).success, false);
  assert.equal(schema.safeParse({ ...config, cache: { maxAgeSeconds: -1 } }).success, false);
});

test("native identity accepts dotted iOS build strings and opaque update UUIDs, rejecting partial metadata", () => {
  const schema = (shared as Record<string, any>).nativeClientIdentitySchema;
  assert.equal(typeof schema?.safeParse, "function");
  const identity = { platform: "ios", appVersion: "1.0.0", appBuild: "12.1.2", runtimeVersion: "1.0.0",
    updateId: "12345678-1234-4234-9234-123456789abc", clientRevision: 1 };
  assert.equal(schema.safeParse(identity).success, true);
  assert.equal(schema.safeParse({ ...identity, updateId: "embedded" }).success, true);
  for (const patch of [{ platform: "web" }, { appVersion: "unknown" }, { appBuild: "-1" },
    { runtimeVersion: "" }, { updateId: "not-a-uuid" }, { clientRevision: 0 }]) {
    assert.equal(schema.safeParse({ ...identity, ...patch }).success, false);
  }
});

test("update errors require a feature and an available HTTPS store destination", () => {
  const schema = (shared as Record<string, any>).appUpdateRequiredSchema;
  assert.equal(typeof schema?.safeParse, "function");
  const error = { code: "APP_UPDATE_REQUIRED", feature: "checkout", policyRevision: "r2",
    message: "Update to checkout", explanation: { ar: "حدّث التطبيق", en: "Update to checkout" },
    storeUrl: "https://play.google.com/store/apps/details?id=com.capellacare.app", requiredRelease: "r2" };
  assert.equal(schema.safeParse(error).success, true);
  assert.equal(schema.safeParse({ ...error, feature: undefined }).success, false);
  assert.equal(schema.safeParse({ ...error, storeUrl: "javascript:alert(1)" }).success, false);
});

test("a release rule cannot demand an upgrade that its advertised release cannot satisfy", () => {
  const registrySchema = (shared as Record<string, any>).releaseRegistrySchema;
  const platform = { appVersion: "1.0.0", appBuild: "1", runtimeVersion: "1.0.0", clientRevision: 1,
    apiContract: "/api/v1", updateIds: ["embedded"], available: true,
    storeUrl: "https://play.google.com/store/apps/details?id=app" };
  const current = { id: "r1", android: platform, ios: { ...platform, storeUrl: "https://apps.apple.com/app/id123" } };
  const rule = { feature: "checkout", requiredRelease: "r1", minimumAppVersion: "9.0.0", minimumAppBuild: "1",
    minimumClientRevision: 1, supportedRuntimes: ["1.0.0"], explanation: { ar: "حدّث", en: "Update" } };
  const registry = { schemaVersion: 1, policyRevision: "r1", cache: { maxAgeSeconds: 0 }, current,
    previous: null, candidate: null, requirements: { android: [rule], ios: [] } };
  assert.equal(registrySchema.safeParse(registry).success, false);
  assert.equal(registrySchema.safeParse({ ...registry, requirements: { android: [{ ...rule, minimumAppVersion: "1.0.0" }], ios: [] } }).success, true);
});
