import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { app } from "../../src/app.js";
import { withTestServer } from "../helpers/request.js";

const originalPolicy = process.env.APP_RELEASE_POLICY_JSON;
afterEach(() => { if (originalPolicy === undefined) delete process.env.APP_RELEASE_POLICY_JSON;
  else process.env.APP_RELEASE_POLICY_JSON = originalPolicy; });
const release = (id: string, version: string, available = true) => ({ id,
  android: { appVersion: version, appBuild: "10", runtimeVersion: version, clientRevision: 1,
    apiContract: "/api/v1", updateIds: ["embedded"], available,
    storeUrl: available ? "https://play.google.com/store/apps/details?id=com.capellacare.app" : null },
  ios: { appVersion: version, appBuild: "10.2", runtimeVersion: version, clientRevision: 1,
    apiContract: "/api/v1", updateIds: ["embedded"], available,
    storeUrl: available ? "https://apps.apple.com/app/id123456789" : null }
});
const policy = () => ({ schemaVersion: 1, policyRevision: "r2", cache: { maxAgeSeconds: 600 },
  current: release("current", "2.0.0"), previous: release("previous", "1.0.0"),
  candidate: release("candidate", "3.0.0", false), requirements: { android: [], ios: [] } });
const headers = (version: string, platform = "android", revision = "1") => ({
  "x-platform": platform, "x-app-version": version, "x-app-build": platform === "ios" ? "10.2" : "10",
  "x-runtime-version": version, "x-update-id": "embedded", "x-client-revision": revision,
  "x-client": "mobile", "content-type": "application/json"
});
const requirement = { feature: "checkout", requiredRelease: "current", minimumAppVersion: "1.0.0",
  minimumAppBuild: "10", minimumClientRevision: 1, supportedRuntimes: ["1.0.0", "2.0.0", "3.0.0"],
  explanation: { ar: "حدّث التطبيق لإتمام الطلب", en: "Update to place an order" } };

test("public app-config works before login without fabricating a published release", async () => {
  await withTestServer(app, async request => {
    const result = await request("/app-config?platform=android");
    assert.equal(result.status, 200);
    assert.equal(result.json.schemaVersion, 1);
    assert.equal(result.json.platform, "android");
    assert.equal(result.json.current, null);
    assert.equal(result.json.recommendedUpdate, null);
    assert.deepEqual(result.json.features, []);
    assert.equal(result.headers.get("cache-control"), "no-store");
  });
});

test("config advertises only public releases and recommends an available current upgrade", async () => {
  const registry = policy();
  registry.candidate!.android = { ...release("candidate", "3.0.0").android };
  process.env.APP_RELEASE_POLICY_JSON = JSON.stringify(registry);
  await withTestServer(app, async request => {
    const result = await request("/app-config", { headers: headers("1.0.0") });
    assert.equal(result.status, 200);
    assert.equal(result.json.current.id, "current");
    assert.equal(result.json.previous.id, "previous");
    assert.equal(result.json.recommendedUpdate.releaseId, "current");
    assert.equal(JSON.stringify(result.json).includes("candidate"), false);
    const latest = await request("/app-config", { headers: headers("2.0.0") });
    assert.equal(latest.json.recommendedUpdate, null);
  });
});

test("recommended updates order build before client revision so a newer build is never downgraded", async () => {
  const registry = policy(); registry.current.android.clientRevision = 2;
  process.env.APP_RELEASE_POLICY_JSON = JSON.stringify(registry);
  await withTestServer(app, async request => {
    const newerBuild = await request("/app-config", { headers: { ...headers("2.0.0"), "x-app-build": "20" } });
    assert.equal(newerBuild.json.recommendedUpdate, null);
    const staleRevision = await request("/app-config", { headers: headers("2.0.0", "android", "1") });
    assert.equal(staleRevision.json.recommendedUpdate.releaseId, "current");
  });
});

test("current, previous and review candidates retain checkout access while a retired client gets a feature error", async () => {
  const registry: any = policy(); registry.requirements.android = [requirement];
  process.env.APP_RELEASE_POLICY_JSON = JSON.stringify(registry);
  await withTestServer(app, async request => {
    for (const version of ["1.0.0", "2.0.0", "3.0.0"]) {
      const result = await request("/api/v1/checkout", { method: "POST", headers: headers(version), body: "{}" });
      assert.equal(result.status, 400, "compatible request reaches checkout input validation");
      assert.notEqual(result.json.code, "APP_UPDATE_REQUIRED");
    }
    const retired = await request("/api/v1/checkout", { method: "POST", headers: headers("0.9.0"), body: "{}" });
    assert.equal(retired.status, 409);
    assert.equal(retired.json.code, "APP_UPDATE_REQUIRED");
    assert.equal(retired.json.feature, "checkout");
    assert.equal(retired.json.requiredRelease, "current");
    assert.equal(retired.json.storeUrl, registry.current.android.storeUrl);
    const methods = await request("/api/v1/payments/paymob/methods", { headers: headers("0.9.0") });
    assert.equal(methods.status, 200);
    const recovery = await request("/api/v1/checkout/invalid/status", { headers: headers("0.9.0") });
    assert.equal(recovery.status, 404);
    assert.equal(recovery.json.message, "Checkout not found");
    const browser = await request("/api/v1/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(browser.status, 400);
    assert.notEqual(browser.json.code, "APP_UPDATE_REQUIRED");
  });
});

test("missing/malformed native metadata settles safely without disabling unrelated operations", async () => {
  const registry: any = policy(); registry.requirements.android = [requirement];
  process.env.APP_RELEASE_POLICY_JSON = JSON.stringify(registry);
  await withTestServer(app, async request => {
    for (const bad of [{ "x-platform": "android" }, { ...headers("2.0.0"), "x-app-build": "bad" },
      { "x-client": "mobile" }, { ...headers("2.0.0"), "x-update-id": "unknown" }]) {
      const result = await request("/api/v1/checkout", { method: "POST", headers: bad });
      assert.equal(result.status, 400);
      assert.equal(result.json.code, "INVALID_APP_METADATA");
    }
    const config = await request("/app-config?platform=web");
    assert.equal(config.status, 400);
    const recovery = await request("/api/v1/checkout/invalid/status", { headers: { "x-platform": "android" } });
    assert.equal(recovery.status, 404);
  });
});

test("an OTA capability minimum uses ordered revisions instead of sorting UUIDs", async () => {
  const registry: any = policy(); registry.current.android.clientRevision = 2;
  registry.requirements.android = [{ ...requirement, minimumClientRevision: 2 }];
  process.env.APP_RELEASE_POLICY_JSON = JSON.stringify(registry);
  await withTestServer(app, async request => {
    const stale = await request("/api/v1/checkout", { method: "POST", headers: {
      ...headers("2.0.0"), "x-update-id": "ffffffff-ffff-4fff-9fff-ffffffffffff" }, body: "{}" });
    assert.equal(stale.json.code, "APP_UPDATE_REQUIRED");
    const updated = await request("/api/v1/checkout", { method: "POST", headers: {
      ...headers("2.0.0", "android", "2"), "x-update-id": "00000000-0000-4000-9000-000000000001" }, body: "{}" });
    assert.equal(updated.status, 400);
    assert.notEqual(updated.json.code, "APP_UPDATE_REQUIRED");
  });
});

test("a broken release policy reports temporary unavailability but leaves payment-status recovery open", async () => {
  process.env.APP_RELEASE_POLICY_JSON = "not json";
  await withTestServer(app, async request => {
    assert.equal((await request("/app-config?platform=ios")).status, 503);
    const protectedResult = await request("/api/v1/checkout", { method: "POST", headers: headers("2.0.0") });
    assert.equal(protectedResult.status, 503);
    assert.equal(protectedResult.json.code, "APP_POLICY_UNAVAILABLE");
    assert.equal((await request("/api/v1/checkout/invalid/status")).status, 404);
  });
});

test("every gated mutation, including Express case-insensitive paths, identifies only its affected feature", async () => {
  const cases = [
    ["PUT", "/api/v1/cart", "cart-sync"], ["POST", "/api/v1/CHECKOUT", "checkout"],
    ["POST", "/api/v1/checkout/shipping/quote", "shipping-quote"],
    ["POST", "/api/v1/checkout/abc/retry", "payment-retry"],
    ["POST", "/api/v1/orders/1/cancel", "order-cancel"],
    ["POST", "/api/v1/wishlist", "wishlist-write"], ["DELETE", "/api/v1/wishlist/product/1", "wishlist-write"],
    ["POST", "/api/v1/reviews", "review-submit"]
  ];
  await withTestServer(app, async request => {
    for (const [method, path, feature] of cases) {
      const registry: any = policy(); registry.requirements.android = [{ ...requirement, feature }];
      process.env.APP_RELEASE_POLICY_JSON = JSON.stringify(registry);
      const result = await request(path, { method, headers: headers("0.9.0"), body: "{}" });
      assert.equal(result.status, 409, path);
      assert.equal(result.json.feature, feature, path);
    }
  });
});
