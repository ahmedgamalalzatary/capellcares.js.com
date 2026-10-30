import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storefront-static-data", () => ({
  loadSitemapData: vi.fn(async () => ({
    brands: [],
    characters: [],
    products: [],
    offers: [],
    collections: [],
    categories: [
      { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: true, hasProducts: true },
      { id: 2, parentId: null, slug: "empty", name: { ar: "فارغ", en: "Empty" }, isLeaf: true, hasProducts: false }
    ]
  }))
}));

import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("lists categories with products and leaves empty ones out", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/category/care"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/category/empty"))).toBe(false);
  });
});
