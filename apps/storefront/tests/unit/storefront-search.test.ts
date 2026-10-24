import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  fetchProducts: vi.fn(async () => []),
  fetchOffers: vi.fn(async () => []),
  fetchCollections: vi.fn(async () => []),
  fetchCategories: vi.fn(async () => [
    { id: 1, parentId: null, slug: "hair", name: { ar: "الشعر", en: "Hair" }, isLeaf: true, hasProducts: true },
    { id: 2, parentId: null, slug: "hair-tools", name: { ar: "أدوات الشعر", en: "Hair tools" }, isLeaf: true, hasProducts: false }
  ])
}));

import { searchStorefront } from "@/lib/storefront-search";

describe("searchStorefront", () => {
  it("never suggests an empty category", async () => {
    const results = await searchStorefront("hair", "en");

    expect(results.categories.map((category) => category.id)).toEqual([1]);
  });
});
