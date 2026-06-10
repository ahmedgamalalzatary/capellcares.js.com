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
});
