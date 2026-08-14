import { afterEach, describe, expect, it, vi } from "vitest";

describe("storefront auth provider API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns null to concurrent callers when refresh throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const authApi = await import("@/lib/auth-provider.api");
    const first = authApi.refreshAccessTokenOrNull();
    const second = authApi.refreshAccessTokenOrNull();

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
    expect(authApi.getCurrentAccessToken()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the current access token when refresh fails transiently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const authApi = await import("@/lib/auth-provider.api");
    authApi.setCurrentAccessToken("existing-token");

    await expect(authApi.refreshAccessTokenOrNull()).resolves.toBeNull();
    expect(authApi.getCurrentAccessToken()).toBe("existing-token");
  });

  it("clears the current access token when the refresh session is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const authApi = await import("@/lib/auth-provider.api");
    authApi.setCurrentAccessToken("expired-token");

    await expect(authApi.refreshAccessTokenOrNull()).resolves.toBeNull();
    expect(authApi.getCurrentAccessToken()).toBeNull();
  });

  it("aborts and ignores an in-flight refresh when logout starts", async () => {
    let releaseRefresh!: (response: unknown) => void;
    let refreshSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce((_url, init: RequestInit) => {
        refreshSignal = init.signal as AbortSignal | undefined;
        return new Promise((resolve) => { releaseRefresh = resolve; });
      })
      .mockResolvedValueOnce({ ok: true, status: 204 }));
    const authApi = await import("@/lib/auth-provider.api");
    authApi.setCurrentAccessToken("customer-a-token");

    const refresh = authApi.refreshAccessTokenOrNull();
    await Promise.resolve();
    const logout = authApi.logoutRequest();
    expect(refreshSignal?.aborted).toBe(true);
    releaseRefresh({ ok: true, status: 200, json: async () => ({ accessToken: "stale-a-token" }) });

    await Promise.all([refresh, logout]);
    expect(authApi.getCurrentAccessToken()).toBeNull();
  });
});
