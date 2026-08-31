import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/shop/section-card", () => ({
  SectionCard: ({ data, categoryName }: any) =>
    createElement("div", { "data-testid": "collection-card" }, `${data.name.en}${categoryName ? ` — ${categoryName}` : ""}`)
}));

vi.mock("@/components/products/filters/filter-drawer", () => ({
  FilterDrawer: () => createElement("div")
}));

vi.mock("@/components/ui/columns-toggle", () => ({
  ColumnsToggle: ({ cols }: any) => createElement("div", { "data-testid": "columns-toggle", "data-cols": cols })
}));

import { CollectionGrid } from "@/components/collections/collection-grid";

const categories = [
  { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, sortOrder: 1, deletedAt: null },
  { id: 2, parentId: 1, slug: "creams", name: { ar: "كريمات", en: "Creams" }, isLeaf: true, sortOrder: 1, deletedAt: null },
  // Still returned by the API, but retired: nothing may be classified under it.
  { id: 99, parentId: null, slug: "retired", name: { ar: "متقاعد", en: "Retired" }, isLeaf: true, sortOrder: 9, deletedAt: "2026-01-01T00:00:00Z" }
];

function makeCollection(id: number, nameEn: string, categoryId: number) {
  return {
    id,
    slug: `collection-${id}`,
    name: { ar: `مجموعة ${id}`, en: nameEn },
    description: { ar: "", en: "" },
    imagePath: "",
    media: [],
    price: 100,
    originalTotal: 150,
    categoryId,
    items: [],
    stock: 5,
    status: "active" as const,
    visibility: "visible" as const,
    createdAt: "",
    updatedAt: ""
  };
}

const dict = {
  common: { filters: "Filters" },
  filters: {
    sortBy: "Sort by",
    sortFeatured: "Featured",
    sortNewest: "Newest",
    sortPriceAsc: "Price low",
    sortPriceDesc: "Price high",
    sortName: "Name"
  },
  collections: { listEmpty: "No collections" }
};

afterEach(() => {
  cleanup();
});

describe("CollectionGrid", () => {
  it("defaults the POV control to two columns", () => {
    render(createElement(CollectionGrid, {
      collections: [makeCollection(1, "Glow Set", 2)], categories, lang: "en" as const, dict
    }));

    expect(screen.getByTestId("columns-toggle")).toHaveAttribute("data-cols", "2");
  });

  it("gives each card its collection's own category name for the classification line", () => {
    render(createElement(CollectionGrid, {
      collections: [makeCollection(1, "Glow Set", 2)],
      categories,
      lang: "en" as const,
      dict
    }));

    expect(screen.getByTestId("collection-card")).toHaveTextContent("Glow Set — Creams");
  });

  it("renders no classification line when the collection points at a deleted category", () => {
    render(createElement(CollectionGrid, {
      collections: [makeCollection(1, "Glow Set", 99)],
      categories,
      lang: "en" as const,
      dict
    }));

    expect(screen.getByTestId("collection-card")).not.toHaveTextContent("—");
  });
});
