import { afterEach, describe, expect, it, vi } from "vitest";

describe("storefront api client", () => {
  const checkoutInput = {
    fullName: "Capella User",
    phone: "01012345678",
    email: "user@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Main Street",
    buildingApartment: "10",
    paymentMethod: "cod" as const,
    items: [{ type: "product" as const, variantId: 4, qty: 1 }]
  };
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

  it("filters malformed products instead of throwing when normalizeProduct hits ensureNumericId", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 9,
              categoryId: 3,
              imagePath: null,
              hoverImagePath: null,
              media: [],
              variants: [],
              status: "active"
            },
            {
              id: undefined,
              categoryId: null,
              imagePath: null,
              hoverImagePath: null,
              media: [],
              variants: [],
              status: "active"
            }
          ]
        })
      })
    );

    const { fetchProducts } = await import("@/lib/api/client");

    await expect(fetchProducts({ lang: "en", throwOnError: true })).resolves.toMatchObject([{ id: 9, categoryId: 3 }]);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to normalize product payload"),
      expect.objectContaining({
        error: expect.any(Error),
        product: expect.objectContaining({ categoryId: null })
      })
    );
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

  it("refreshes and retries an authenticated checkout exactly once after a 401", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: "Expired" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: "fresh-token" }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 8, orderCode: "ORD-8", paymentStatus: "pending" })
      }));

    const { submitCheckout } = await import("@/lib/api/client");
    await expect(submitCheckout(checkoutInput, "expired-token")).resolves.toMatchObject({ orderCode: "ORD-8" });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining("/api/v1/checkout"),
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer fresh-token" }) }));
  });

  it("does not retry the token that just received a 401", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: "Expired" }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ message: "Unavailable" }) }));

    const authApi = await import("@/lib/auth-provider.api");
    authApi.setCurrentAccessToken("expired-token");
    const { fetchCustomerOrders } = await import("@/lib/api/client");

    await expect(fetchCustomerOrders("expired-token")).rejects.toThrow("API 401");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never submits a signed-in checkout as guest when no access token is available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    const { submitCheckout } = await import("@/lib/api/client");
    await expect(submitCheckout(checkoutInput, null, { requireAuthentication: true })).rejects.toThrow(
      "Authentication required"
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/auth/refresh"), expect.anything());
  });

  it("does not retry a checkout after the signed-in account changes", async () => {
    let releaseCheckout!: (response: unknown) => void;
    const firstCheckout = new Promise((resolve) => { releaseCheckout = resolve; });
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => firstCheckout)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: "customer-b-token",
          user: { id: 2, name: "Customer B", email: "b@capella.test" }
        })
      }));

    const authApi = await import("@/lib/auth-provider.api");
    authApi.setCurrentAccessToken("customer-a-token");
    const { submitCheckout } = await import("@/lib/api/client");
    const pending = submitCheckout(checkoutInput, "customer-a-token", { requireAuthentication: true });

    await authApi.loginRequest("b@capella.test", "password");
    releaseCheckout({ ok: false, status: 401, json: async () => ({ message: "Expired" }) });

    await expect(pending).rejects.toThrow("Expired");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces authenticated order connection failures", async () => {
    const failure = new TypeError("network down");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    const { fetchCustomerOrders } = await import("@/lib/api/client");

    await expect(fetchCustomerOrders("token")).rejects.toBe(failure);
  });
});
