import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Product } from "@capella/shared";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/en/category/care",
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

// The cards pull in the cart/wishlist providers and say nothing about filtering.
vi.mock("@/components/products/product-card", () => ({
  ProductCard: ({ product }: any) => createElement("div", { "data-testid": "product-card" }, product.slug)
}));

import { ProductGrid } from "@/components/products/grid/product-grid";

const categories: Category[] = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
  { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: true }
];

const products: Product[] = [
  {
    id: 1,
    sku: "SERUM-1",
    slug: "rose-serum",
    name: { ar: "سيروم الورد", en: "Rose Serum" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 100,
    imagePath: "/rose.png",
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 2,
    variants: [{ id: 11, productId: 1, size: "30ml", price: 220, stock: 4 }],
    createdAt: "",
    updatedAt: ""
  }
];

const dict: any = {
  brand: "Capella",
  nav: { search: "Search", allCategories: "All categories", allCategoryTypes: "All {name} Types" },
  filters: {
    title: "Filters",
    bytype: "By type",
    price: "Price",
    priceMin: "Min",
    priceMax: "Max",
    sortBy: "Sort",
    sortFeatured: "Featured",
    sortNewest: "Newest",
    sortPriceAsc: "Low to high",
    sortPriceDesc: "High to low",
    sortName: "Name",
    closeFilters: "Close filters",
    showResults: "Show results",
    toggleCategory: "Toggle category",
    to: "to"
  },
  common: { clear: "Clear", filters: "Filters", from: "from" },
  badges: {},
  product: {}
};

describe("ProductGrid", () => {
  it("names the catch-all category pill after the scoped category", () => {
    render(createElement(ProductGrid, {
      products,
      categories,
      lang: "en",
      dict,
      initialCategory: 1,
      scopedCategoryId: 1
    }));

    expect(screen.getByText("All Care Types")).toBeInTheDocument();
    expect(screen.queryByText("All categories")).not.toBeInTheDocument();
  });

  it("keeps the generic category pill when the page is not scoped to a category", () => {
    render(createElement(ProductGrid, {
      products,
      categories,
      lang: "en",
      dict
    }));

    expect(screen.getByText("All categories")).toBeInTheDocument();
    expect(screen.queryByText("All Care Types")).not.toBeInTheDocument();
  });
});
