import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchProducts,
  fetchOffers,
  fetchCollections,
  fetchAdvices,
  fetchCategories,
  fetchShopMediaSections,
  fetchBrands,
  fetchGenders,
} = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  fetchOffers: vi.fn(),
  fetchCollections: vi.fn(),
  fetchAdvices: vi.fn(),
  fetchCategories: vi.fn(),
  fetchShopMediaSections: vi.fn(),
  fetchBrands: vi.fn(),
  fetchGenders: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  fetchProducts,
  fetchOffers,
  fetchCollections,
  fetchAdvices,
  fetchCategories,
  fetchShopMediaSections,
  fetchBrands,
  fetchGenders,
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
    fetchBrands.mockReset();
    fetchBrands.mockRejectedValue(new Error("offline"));
    fetchGenders.mockReset();
    fetchGenders.mockRejectedValue(new Error("offline"));
  });

  it("returns empty shop data when the API is unavailable", async () => {
    fetchCategories.mockRejectedValue(new Error("offline"));
    fetchAdvices.mockRejectedValue(new Error("offline"));
    fetchShopMediaSections.mockRejectedValue(new Error("offline"));

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    await expect(loadShopPageData("ar")).resolves.toEqual({
      categories: [],
      brands: [],
      genders: [],
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
      brands: [],
      genders: [],
      products: [],
      categories: [],
      offers: [],
      collections: []
    });
  });
});
