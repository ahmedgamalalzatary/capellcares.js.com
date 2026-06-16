import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchProducts = vi.fn();
const fetchOffers = vi.fn();
const fetchCollections = vi.fn();
const fetchAdvices = vi.fn();
const fetchCategories = vi.fn();
const fetchShopMediaSections = vi.fn();

vi.mock("@/lib/api/client", () => ({
  fetchProducts: (...args: unknown[]) => fetchProducts(...args),
  fetchOffers: (...args: unknown[]) => fetchOffers(...args),
  fetchCollections: (...args: unknown[]) => fetchCollections(...args),
  fetchAdvices: (...args: unknown[]) => fetchAdvices(...args),
  fetchCategories: (...args: unknown[]) => fetchCategories(...args),
  fetchShopMediaSections: (...args: unknown[]) => fetchShopMediaSections(...args)
}));

describe("storefront static data", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchProducts.mockReset();
    fetchOffers.mockReset();
    fetchCollections.mockReset();
    fetchAdvices.mockReset();
    fetchCategories.mockReset();
    fetchShopMediaSections.mockReset();
  });

  it("returns empty shop data when the API is unavailable", async () => {
    fetchProducts.mockRejectedValue(new Error("offline"));
    fetchOffers.mockRejectedValue(new Error("offline"));
    fetchCollections.mockRejectedValue(new Error("offline"));
    fetchAdvices.mockRejectedValue(new Error("offline"));
    fetchShopMediaSections.mockRejectedValue(new Error("offline"));

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    await expect(loadShopPageData("ar")).resolves.toEqual({
      products: [],
      offers: [],
      collections: [],
      advices: [],
      shopMediaSections: []
    });
  });

  it("returns empty sitemap data when the API is unavailable", async () => {
    fetchProducts.mockRejectedValue(new Error("offline"));
    fetchCategories.mockRejectedValue(new Error("offline"));
    fetchOffers.mockRejectedValue(new Error("offline"));
    fetchCollections.mockRejectedValue(new Error("offline"));

    const { loadSitemapData } = await import("@/lib/storefront-static-data");

    await expect(loadSitemapData()).resolves.toEqual({
      products: [],
      categories: [],
      offers: [],
      collections: []
    });
  });
});
