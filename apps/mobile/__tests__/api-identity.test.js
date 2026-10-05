jest.mock("../src/lib/api/base", () => ({ API_BASE: "https://api.example.com" }));
jest.mock("expo-application", () => ({ __esModule: true, nativeApplicationVersion: "1.0.0", nativeBuildVersion: "23" }));
jest.mock("expo-updates", () => ({ __esModule: true, runtimeVersion: "native-runtime-1", updateId: null, isEmbeddedLaunch: true }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: "standalone" } }));

const response = (status, body) => ({ ok: status >= 200 && status < 300, status,
  json: async () => body, text: async () => JSON.stringify(body) });
const identity = { "x-app-version": "1.0.0", "x-app-build": "23", "x-platform": "android",
  "x-runtime-version": "native-runtime-1", "x-update-id": "embedded", "x-client-revision": "1" };

describe("native identity across the real HTTP boundary", () => {
  let http, application, updates, platform;
  beforeEach(() => {
    jest.resetModules(); global.fetch = jest.fn(); global.__DEV__ = false;
    platform = require("react-native").Platform;
    Object.defineProperty(platform, "OS", { value: "android", configurable: true });
    application = require("expo-application"); updates = require("expo-updates");
    http = require("../src/lib/api/http");
  });
  afterEach(() => { delete global.fetch; global.__DEV__ = true; });

  test("sends the installed native version/build/runtime on public calls and authenticated retries", async () => {
    http.configureAuthSessionAdapter({ getAccessToken: () => "old", getSessionRevision: () => 1,
      refreshAccessToken: async () => "new" });
    global.fetch.mockResolvedValueOnce(response(200, {})).mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(200, { ok: true }));
    await http.getJSON("/app-config", { lang: "ar" });
    await http.authedMutationJSON("/api/v1/cart", "old", { method: "PUT", body: { lines: [] }, idempotencyKey: "k" }, { lang: "en" });
    for (const [, init] of global.fetch.mock.calls) expect(init.headers).toEqual(expect.objectContaining(identity));
    expect(global.fetch.mock.calls[2][1]).toEqual(expect.objectContaining({ method: "PUT",
      body: JSON.stringify({ lines: [] }), headers: expect.objectContaining({
        authorization: "Bearer new", "idempotency-key": "k", "x-lang": "en"
      }) }));
  });

  test("preserves actual OTA UUIDs and iOS dotted build numbers", async () => {
    Object.defineProperty(platform, "OS", { value: "ios", configurable: true });
    application.nativeBuildVersion = "23.1.2";
    updates.updateId = "12345678-1234-4234-9234-123456789abc"; updates.isEmbeddedLaunch = false;
    global.fetch.mockResolvedValue(response(200, {}));
    await http.getJSON("/read");
    expect(global.fetch.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      "x-app-build": "23.1.2", "x-platform": "ios", "x-update-id": updates.updateId
    }));
  });

  test("refuses missing production metadata instead of inventing embedded identity", async () => {
    updates.isEmbeddedLaunch = false; updates.updateId = null;
    await expect(http.getJSON("/read", { throwOnError: true })).rejects.toMatchObject({ code: "INVALID_APP_METADATA" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("browser preview sends language without claiming native identity", async () => {
    Object.defineProperty(platform, "OS", { value: "web", configurable: true });
    global.fetch.mockResolvedValue(response(200, {}));
    await http.getJSON("/read", { lang: "ar" });
    expect(global.fetch.mock.calls[0][1].headers).toEqual({ "x-lang": "ar" });
  });

  test("auth refresh carries native identity, mobile transport and the supplied refresh header without retrying", async () => {
    expect(typeof http.authJSON).toBe("function");
    global.fetch.mockResolvedValue(response(401, { message: "Expired" }));
    await expect(http.authJSON("refresh", undefined, { lang: "ar", refreshToken: "secret" })).rejects.toMatchObject({ status: 401 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0]).toEqual(["https://api.example.com/api/v1/auth/refresh", expect.objectContaining({
      headers: expect.objectContaining({ ...identity, "x-client": "mobile", "x-refresh-token": "secret", "x-lang": "ar" })
    })]);
  });
});
