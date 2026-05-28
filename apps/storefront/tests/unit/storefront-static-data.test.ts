import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchProducts = vi.fn();
const fetchOffers = vi.fn();
const fetchAdvices = vi.fn();
const fetchCategories = vi.fn();

vi.mock("@/lib/api/client", () => ({
  fetchProducts: (...args: unknown[]) => fetchProducts(...args),
  fetchOffers: (...args: unknown[]) => fetchOffers(...args),
  fetchAdvices: (...args: unknown[]) => fetchAdvices(...args),
  fetchCategories: (...args: unknown[]) => fetchCategories(...args)
}));

describe("storefront static data", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchProducts.mockReset();
    fetchOffers.mockReset();
    fetchAdvices.mockReset();
    fetchCategories.mockReset();
  });

  it("returns empty shop data when the API is unavailable", async () => {
    fetchProducts.mockRejectedValue(new Error("offline"));
    fetchOffers.mockRejectedValue(new Error("offline"));
    fetchAdvices.mockRejectedValue(new Error("offline"));

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    await expect(loadShopPageData("ar")).resolves.toEqual({
      products: [],
      offers: [],
      advices: []
    });
  });

  it("returns empty sitemap data when the API is unavailable", async () => {
    fetchProducts.mockRejectedValue(new Error("offline"));
    fetchCategories.mockRejectedValue(new Error("offline"));
    fetchOffers.mockRejectedValue(new Error("offline"));

    const { loadSitemapData } = await import("@/lib/storefront-static-data");

    await expect(loadSitemapData()).resolves.toEqual({
      products: [],
      categories: [],
      offers: []
    });
  });
});
