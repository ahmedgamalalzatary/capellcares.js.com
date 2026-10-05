import assert from "node:assert/strict";
import test from "node:test";
import * as policy from "../../src/modules/app-policy/app-policy.js";

const release = (id: string, version: string, available = true) => ({ id,
  android: { appVersion: version, appBuild: "10", runtimeVersion: version, clientRevision: 1,
    apiContract: "/api/v1" as const, updateIds: ["embedded"], available,
    storeUrl: available ? "https://play.google.com/store/apps/details?id=com.capellacare.app" : null },
  ios: { appVersion: version, appBuild: "10.2", runtimeVersion: version, clientRevision: 1,
    apiContract: "/api/v1" as const, updateIds: ["embedded"], available,
    storeUrl: available ? "https://apps.apple.com/app/id123456789" : null }
});

test("promotion waits for both stores and preserves the public slots during staggered availability", () => {
  const promote = (policy as Record<string, any>).promoteReleaseCandidate;
  assert.equal(typeof promote, "function");
  const registry = { ...policy.PRELAUNCH_POLICY, current: release("current", "2.0.0"),
    previous: release("previous", "1.0.0"), candidate: release("candidate", "3.0.0", false) };
  registry.candidate.android = release("candidate", "3.0.0").android;
  assert.throws(() => promote(registry, "r3"), /both stores/i);
  assert.equal(registry.current.id, "current");
  assert.equal(registry.previous.id, "previous");
  registry.candidate.ios = release("candidate", "3.0.0").ios;
  const result = promote(registry, "r3");
  assert.equal(result.registry.current.id, "candidate");
  assert.equal(result.registry.previous.id, "current");
  assert.equal(result.registry.candidate, null);
  assert.equal(result.registry.policyRevision, "r3");
  assert.equal(result.retired.id, "previous");
  assert.equal(registry.current.id, "current", "promotion does not mutate live configuration");
});

test("release comparisons handle dotted iOS builds and numeric ordering without integer overflow", () => {
  assert.equal(policy.compareReleaseNumbers("10.0.0", "9.0.0"), 1);
  assert.equal(policy.compareReleaseNumbers("10.2", "10.11"), -1);
  assert.equal(policy.compareReleaseNumbers("9007199254740993", "9007199254740992"), 1);
});
