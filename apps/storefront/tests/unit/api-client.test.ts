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
});
