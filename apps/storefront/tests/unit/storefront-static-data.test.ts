import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchProducts,
  fetchOffers,
  fetchCollections,
  fetchAdvices,
  fetchCategories,
  fetchShopLayout
} = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  fetchOffers: vi.fn(),
  fetchCollections: vi.fn(),
  fetchAdvices: vi.fn(),
  fetchCategories: vi.fn(),
  fetchShopLayout: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  fetchProducts,
  fetchOffers,
  fetchCollections,
  fetchAdvices,
  fetchCategories,
  fetchShopLayout
}));

describe("storefront static data", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchProducts.mockReset();
    fetchOffers.mockReset();
    fetchCollections.mockReset();
    fetchAdvices.mockReset();
    fetchCategories.mockReset();
    fetchShopLayout.mockReset();
  });

  it("returns empty shop data when the API is unavailable", async () => {
    fetchProducts.mockRejectedValue(new Error("offline"));
    fetchOffers.mockRejectedValue(new Error("offline"));
    fetchCollections.mockRejectedValue(new Error("offline"));
    fetchAdvices.mockRejectedValue(new Error("offline"));
    fetchShopLayout.mockRejectedValue(new Error("offline"));

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    await expect(loadShopPageData("ar")).resolves.toEqual({
      products: [],
      offers: [],
      collections: [],
      advices: [],
      // With no layout the page still shows its built-in sections in their usual order.
      layout: ["category_tiles", "offers", "collections", "bestsellers", "new"].map((type, index) => ({
        id: -(index + 1), type, categoryId: null, mediaSection: null, sortOrder: index + 1
      }))
    });
  });

  it("uses the shop layout the API returns, as saved", async () => {
    const layout = [{ id: 7, type: "category", categoryId: 3, mediaSection: null, sortOrder: 1 }];
    fetchShopLayout.mockResolvedValue(layout);

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    expect((await loadShopPageData("en")).layout).toEqual(layout);
  });

  it("falls back to the built-in sections when the API has no layout to give", async () => {
    fetchShopLayout.mockResolvedValue(null);

    const { loadShopPageData } = await import("@/lib/storefront-static-data");

    expect((await loadShopPageData("en")).layout.map((block) => block.type)).toEqual(["category_tiles", "offers", "collections", "bestsellers", "new"]);
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
