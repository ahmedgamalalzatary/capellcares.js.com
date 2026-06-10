import { afterEach, describe, expect, it, vi } from "vitest";

describe("storefront api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns an empty offers list when the API connection fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const { fetchOffers } = await import("@/lib/api/client");

    await expect(fetchOffers({ lang: "ar" })).resolves.toEqual([]);
  });

  it("returns null for offer detail when the API connection fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const { fetchOfferBySlug } = await import("@/lib/api/client");

    await expect(fetchOfferBySlug("bundle-1", { lang: "ar" })).resolves.toBeNull();
  });

  it("rethrows connection failures when throwOnError is set (so Ask Capella shows an error, not 'no results')", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const { fetchProducts } = await import("@/lib/api/client");

    await expect(fetchProducts({ q: "oil", lang: "en", throwOnError: true })).rejects.toThrow(TypeError);
  });

  it("still swallows connection failures by default", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const { fetchProducts } = await import("@/lib/api/client");

    await expect(fetchProducts({ q: "oil", lang: "en" })).resolves.toEqual([]);
  });

  it("refreshes and retries customer order requests when the access token expires", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ accessToken: "fresh-token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 5, orderCode: "ORD-5" }] })
      }));

    const { fetchCustomerOrders } = await import("@/lib/api/client");

    await expect(fetchCustomerOrders("expired-token")).resolves.toEqual([{ id: 5, orderCode: "ORD-5" }]);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/api/v1/orders"),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer expired-token" })
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/api/v1/auth/refresh"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/api/v1/orders"),
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer fresh-token" })
      })
    );
  });
});
