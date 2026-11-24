import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchProducts,
  fetchOffers,
  fetchCollections,
  fetchAdvices,
  fetchCategories,
  fetchShopLayout,
  fetchBrands,
  fetchGenders,
} = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  fetchOffers: vi.fn(),
  fetchCollections: vi.fn(),
  fetchAdvices: vi.fn(),
  fetchCategories: vi.fn(),
  fetchShopLayout: vi.fn(),
  fetchBrands: vi.fn(),
  fetchGenders: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  fetchProducts,
  fetchOffers,
  fetchCollections,
  fetchAdvices,
  fetchCategories,
  fetchShopLayout,
  fetchBrands,
  fetchGenders,
}));

/** The built-in sections in their usual order, as the shop page shows them when the layout can't be loaded. */
const BUILT_IN_LAYOUT = ["genders", "category_tiles", "bestsellers", "new", "offers", "brands"];

describe("storefront static data", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchProducts.mockReset();
    fetchOffers.mockReset();
    fetchCollections.mockReset();
    fetchAdvices.mockReset();
    fetchCategories.mockReset();
    fetchShopLayout.mockReset();
    fetchBrands.mockReset();
    fetchBrands.mockRejectedValue(new Error("offline"));
    fetchGenders.mockReset();
    fetchGenders.mockRejectedValue(new Error("offline"));
  });

  it("returns empty shop data and the built-in sections when the API is unavailable", async () => {
    fetchCategories.mockRejectedValue(new Error("offline"));
    fetchAdvices.mockRejectedValue(new Error("offline"));
    fetchShopLayout.mockRejectedValue(new Error("offline"));
    fetchProducts.mockRejectedValue(new Error("offline"));
    fetchOffers.mockRejectedValue(new Error("offline"));

    const { loadShopPageData } = await import("@/lib/storefront-static-data");
    const data = await loadShopPageData("ar");

    expect({ ...data, layout: undefined }).toEqual({
      categories: [],
      brands: [],
      genders: [],
      advices: [],
      products: [],
      categoryProducts: new Map(),
      offers: [],
      collections: [],
      layout: undefined
    });
    expect(data.layout.map((block) => block.type)).toEqual(BUILT_IN_LAYOUT);
  });

  it("fetches collections only when the layout has the collections section", async () => {
    for (const fetcher of [fetchCategories, fetchAdvices, fetchProducts, fetchOffers]) fetcher.mockResolvedValue([]);
    fetchCollections.mockResolvedValue([{ id: 1 }]);
    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    fetchShopLayout.mockResolvedValue([{ id: 1, type: "new", categoryId: null, mediaSection: null, sortOrder: 1 }]);
    expect((await loadShopPageData("en")).collections).toEqual([]);
    expect(fetchCollections).not.toHaveBeenCalled();

    fetchShopLayout.mockResolvedValue([{ id: 2, type: "collections", categoryId: null, mediaSection: null, sortOrder: 1 }]);
    expect((await loadShopPageData("en")).collections).toEqual([{ id: 1 }]);
  });

  it("falls back to the built-in sections when the layout comes back empty-handed", async () => {
    fetchShopLayout.mockResolvedValue(null);
    for (const fetcher of [fetchCategories, fetchAdvices, fetchProducts, fetchOffers]) fetcher.mockResolvedValue([]);

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    expect((await loadShopPageData("en")).layout.map((block) => block.type)).toEqual(BUILT_IN_LAYOUT);
  });

  it("passes on the layout saved in the ERP", async () => {
    const saved = [
      { id: 7, type: "new", categoryId: null, mediaSection: null, sortOrder: 1 },
      { id: 8, type: "category", categoryId: 3, mediaSection: null, sortOrder: 2 }
    ];
    fetchShopLayout.mockResolvedValue(saved);
    for (const fetcher of [fetchCategories, fetchAdvices, fetchProducts, fetchOffers]) fetcher.mockResolvedValue([]);

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    expect((await loadShopPageData("en")).layout).toEqual(saved);
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
