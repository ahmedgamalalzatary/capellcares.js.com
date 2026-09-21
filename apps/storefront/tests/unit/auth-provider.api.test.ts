import { afterEach, describe, expect, it, vi } from "vitest";

describe("storefront auth provider API", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("waits for the cross-tab refresh lock before rotating the cookie", async () => {
    let enterLock!: () => void;
    const gate = new Promise<void>((resolve) => { enterLock = resolve; });
    const request = vi.fn(async (_name: string, callback: () => Promise<Response>) => {
      await gate;
      return callback();
    });
    vi.stubGlobal("navigator", { locks: { request } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const { refreshAccessToken } = await import("@/lib/auth-provider.api");

    const refresh = refreshAccessToken();
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();

    enterLock();
    await refresh;
    expect(request).toHaveBeenCalledWith("capella:customer-refresh", expect.any(Function));
    expect(fetch).toHaveBeenCalledTimes(1);
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

  it("settles refresh when the network request hangs past the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      });
    }));

    const authApi = await import("@/lib/auth-provider.api");
    authApi.setCurrentAccessToken("existing-token");
    const refresh = authApi.refreshAccessTokenOrNull();

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(refresh).resolves.toBeNull();
    expect(authApi.getCurrentAccessToken()).toBe("existing-token");
    vi.useRealTimers();
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

  it("passes the fetch signal through the cross-tab refresh lock when available", async () => {
    const request = vi.fn(async (_name: string, _opts: unknown, _callback?: unknown) => {
      const callback = (typeof _opts === "function" ? _opts : _callback) as () => Promise<Response>;
      return callback();
    });
    vi.stubGlobal("navigator", { locks: { request } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const { refreshAccessToken } = await import("@/lib/auth-provider.api");

    const controller = new AbortController();
    await refreshAccessToken(controller.signal);

    expect(request).toHaveBeenCalledTimes(1);
    const args = request.mock.calls[0]!;
    expect(args[0]).toBe("capella:customer-refresh");
    expect(args[1]).toMatchObject({ signal: controller.signal });
    expect(typeof args[2]).toBe("function");
  });
});
