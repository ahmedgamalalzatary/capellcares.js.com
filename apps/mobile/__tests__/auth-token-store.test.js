const mockSecureStoreData = new Map();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key) => (mockSecureStoreData.has(key) ? mockSecureStoreData.get(key) : null)),
  setItemAsync: jest.fn(async (key, value) => { mockSecureStoreData.set(key, value); }),
  deleteItemAsync: jest.fn(async (key) => { mockSecureStoreData.delete(key); })
}));

const mockAuthJSON = jest.fn();
const mockApiError = class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
};
jest.mock("../src/lib/api/http", () => ({
  authJSON: (...args) => mockAuthJSON(...args),
  ApiError: mockApiError
}));

const SecureStore = require("expo-secure-store");
const { CUSTOMER_REFRESH_TOKEN_KEY } = require("../src/constants/storage");
const tokenStore = require("../src/lib/auth/token-store");

describe("auth token store", () => {
  beforeEach(async () => {
    mockSecureStoreData.clear();
    mockAuthJSON.mockReset();
    SecureStore.setItemAsync.mockClear();
    SecureStore.deleteItemAsync.mockClear();
    await tokenStore.clearSession();
  });

  test("persists the refresh token and publishes the access token on sign-in", async () => {
    const tokens = [];
    tokenStore.subscribeAccessToken((token) => tokens.push(token));

    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });

    expect(tokenStore.getAccessToken()).toBe("access-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(CUSTOMER_REFRESH_TOKEN_KEY, "refresh-1");
    expect(mockSecureStoreData.get(CUSTOMER_REFRESH_TOKEN_KEY)).toBe("refresh-1");
    expect(tokens).toEqual(["access-1"]);
  });

  test("does not publish a rotated access token when persisting the rotated refresh token fails", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error("keychain unavailable"));
    mockAuthJSON.mockResolvedValue({ accessToken: "access-2", refreshToken: "refresh-2" });

    const result = await tokenStore.refreshAccessToken();

    expect(result).toBeNull();
    // The rotated token must not be published before it is durably persisted.
    expect(tokenStore.getAccessToken()).toBe("access-1");
  });

  test("keeps recoverable state when a refresh fails transiently", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    mockAuthJSON.mockRejectedValue(new mockApiError(500, "Unable to refresh session"));

    const result = await tokenStore.refreshAccessToken();

    expect(result).toBeNull();
    expect(tokenStore.getAccessToken()).toBe("access-1");
    expect(mockSecureStoreData.get(CUSTOMER_REFRESH_TOKEN_KEY)).toBe("refresh-1");
  });

  test("clears local credentials when a refresh is genuinely rejected", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    const cleared = [];
    tokenStore.subscribeCleared(() => cleared.push(true));
    mockAuthJSON.mockRejectedValue(new mockApiError(401, "Invalid refresh token"));

    const result = await tokenStore.refreshAccessToken();

    expect(result).toBeNull();
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(mockSecureStoreData.has(CUSTOMER_REFRESH_TOKEN_KEY)).toBe(false);
    expect(cleared).toHaveLength(1);
  });

  test("single-flights concurrent refreshes", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    let resolveRefresh;
    mockAuthJSON.mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));

    const first = tokenStore.refreshAccessToken();
    const second = tokenStore.refreshAccessToken();

    expect(mockAuthJSON).toHaveBeenCalledTimes(1);

    resolveRefresh({ accessToken: "access-2", refreshToken: "refresh-2" });
    expect(await first).toBe("access-2");
    expect(await second).toBe("access-2");
  });

  test("does not resurrect credentials when the session is cleared mid-refresh", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    let resolveRefresh;
    mockAuthJSON.mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));

    const refresh = tokenStore.refreshAccessToken();
    await tokenStore.clearSession();
    resolveRefresh({ accessToken: "access-2", refreshToken: "refresh-2" });

    expect(await refresh).toBeNull();
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(mockSecureStoreData.has(CUSTOMER_REFRESH_TOKEN_KEY)).toBe(false);
  });

  test("keeps the session revision stable across a routine refresh", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    const revisionAfterLogin = tokenStore.getSessionRevision();
    mockAuthJSON.mockResolvedValue({ accessToken: "access-2", refreshToken: "refresh-2" });

    await tokenStore.refreshAccessToken();

    expect(tokenStore.getAccessToken()).toBe("access-2");
    // A refresh rotates the access token for the SAME session; the HTTP layer treats a revision
    // change as an account swap and would refuse to retry the request.
    expect(tokenStore.getSessionRevision()).toBe(revisionAfterLogin);
  });

  test("advances the session revision when a new session replaces the current one", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    const before = tokenStore.getSessionRevision();

    await tokenStore.setAuthenticatedSession({ accessToken: "access-b", refreshToken: "refresh-b" });

    expect(tokenStore.getSessionRevision()).toBeGreaterThan(before);
  });

  test("advances the session revision when the session is cleared", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    const before = tokenStore.getSessionRevision();

    await tokenStore.clearSession();

    expect(tokenStore.getSessionRevision()).toBeGreaterThan(before);
  });

  test("does not advance the session revision when the durable write fails", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    const before = tokenStore.getSessionRevision();
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error("keychain unavailable"));

    await expect(
      tokenStore.setAuthenticatedSession({ accessToken: "access-2", refreshToken: "refresh-2" })
    ).rejects.toThrow("keychain unavailable");

    // The session was never established, so its identity must not advance.
    expect(tokenStore.getSessionRevision()).toBe(before);
    expect(tokenStore.getAccessToken()).toBe("access-1");
  });

  test("starts a fresh refresh after a new session replaces an in-flight one", async () => {
    await tokenStore.setAuthenticatedSession({ accessToken: "access-1", refreshToken: "refresh-1" });
    let resolveFirst;
    mockAuthJSON.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));

    const first = tokenStore.refreshAccessToken();
    // A sign-in lands while the previous session's refresh is still in flight.
    await tokenStore.setAuthenticatedSession({ accessToken: "access-b", refreshToken: "refresh-b" });
    resolveFirst({ accessToken: "access-2", refreshToken: "refresh-2" });
    expect(await first).toBeNull();

    mockAuthJSON.mockResolvedValue({ accessToken: "access-b2", refreshToken: "refresh-b2" });
    // The stale in-flight promise must not swallow the new session's refresh.
    expect(await tokenStore.refreshAccessToken()).toBe("access-b2");
  });

  test("restores a session from the stored refresh token", async () => {
    mockSecureStoreData.set(CUSTOMER_REFRESH_TOKEN_KEY, "stored-refresh");
    mockAuthJSON.mockResolvedValue({ accessToken: "access-restored", refreshToken: "rotated-refresh" });

    const restored = await tokenStore.bootstrapSession();

    expect(restored).toBe(true);
    expect(tokenStore.getAccessToken()).toBe("access-restored");
    expect(mockAuthJSON).toHaveBeenCalledWith("refresh", undefined, { refreshToken: "stored-refresh" });
  });

  test("reports no restorable session when nothing is stored", async () => {
    const restored = await tokenStore.bootstrapSession();

    expect(restored).toBe(false);
    expect(mockAuthJSON).not.toHaveBeenCalled();
  });
});
