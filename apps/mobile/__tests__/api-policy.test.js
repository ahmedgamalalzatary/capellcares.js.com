jest.mock("../src/lib/api/base", () => ({ API_BASE: "https://api.example.com" }));
const config = { schemaVersion: 1, policyRevision: "prelaunch-v1", platform: "android",
  cache: { maxAgeSeconds: 0 }, current: null, previous: null, recommendedUpdate: null, features: [] };
const requirement = { code: "APP_UPDATE_REQUIRED", feature: "checkout", policyRevision: "r2",
  message: "Update to checkout", explanation: { ar: "حدّث التطبيق", en: "Update to checkout" },
  storeUrl: "https://play.google.com/store/apps/details?id=com.capellacare.app", requiredRelease: "r2" };
const response = (status, body) => ({ ok: status >= 200 && status < 300, status,
  json: async () => body, text: async () => JSON.stringify(body) });

describe("native policy boundary", () => {
  let client, http;
  beforeEach(() => { jest.resetModules(); global.fetch = jest.fn();
    http = require("../src/lib/api/http"); client = require("../src/lib/api/client"); });
  afterEach(() => { delete global.fetch; });

  test("fetches validated policy from the unversioned origin before login", async () => {
    global.fetch.mockResolvedValue(response(200, config));
    expect(typeof client.fetchAppConfig).toBe("function");
    await expect(client.fetchAppConfig("android", { lang: "ar" })).resolves.toEqual(config);
    expect(global.fetch.mock.calls[0]).toEqual(["https://api.example.com/app-config?platform=android", expect.objectContaining({
      headers: expect.objectContaining({ "x-lang": "ar" })
    })]);
  });

  test.each([{}, { ...config, schemaVersion: 2 }, { ...config, platform: "ios" },
    { ...config, cache: { maxAgeSeconds: -1 } }, { ...config, features: [{}] }])("rejects an unusable policy response (%j)", async body => {
    global.fetch.mockResolvedValue(response(200, body));
    await expect(Promise.resolve().then(() => client.fetchAppConfig("android"))).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });

  test("rejects a policy that offers an unavailable current release or a disconnected store action", async () => {
    const release = { appVersion: "1.0.0", appBuild: "1", runtimeVersion: "1.0.0", clientRevision: 1,
      apiContract: "/api/v1", updateIds: ["embedded"], storeUrl: null, available: false };
    global.fetch.mockResolvedValueOnce(response(200, { ...config, current: { id: "r1", release } }))
      .mockResolvedValueOnce(response(200, { ...config, recommendedUpdate: {
        releaseId: "missing", storeUrl: "https://play.google.com/store/apps/details?id=app",
        explanation: { ar: "حدّث", en: "Update" } } }));
    await expect(client.fetchAppConfig("android")).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
    await expect(client.fetchAppConfig("android")).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });

  test("preserves the feature and validated store action in an update-required error", async () => {
    global.fetch.mockResolvedValue(response(409, requirement));
    const error = await http.authedMutationJSON("/api/v1/checkout", null, { method: "POST" }).catch(error => error);
    expect(error).toBeInstanceOf(http.ApiError);
    expect(error).toMatchObject({ status: 409, code: "APP_UPDATE_REQUIRED", feature: "checkout", updateRequired: requirement });
  });

  test("a malformed update error cannot supply an unsafe store action", async () => {
    global.fetch.mockResolvedValue(response(409, { ...requirement, storeUrl: "javascript:alert(1)" }));
    const error = await http.getJSON("/required", { throwOnError: true }).catch(error => error);
    expect(error.code).toBe("APP_UPDATE_REQUIRED");
    expect(error.updateRequired).toBeUndefined();
  });
});
