import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: ({ items }: any) => createElement("nav", null, items.map((item: any) => item.label).join(" / "))
}));

vi.mock("@/components/products/grid/product-grid", () => ({
  ProductGrid: ({ categories, initialCategory, lockCategory }: any) =>
    createElement(
      "div",
      { "data-testid": "product-grid" },
      `categories:${categories.map((category: any) => category.id).join(",")};initial:${initialCategory ?? "none"};locked:${lockCategory ? "yes" : "no"}`
    )
}));

vi.mock("@/lib/storefront-detail-page", () => ({
  resolveStorefrontSlugPageContext: async () => ({
    lang: "en",
    slug: "skin-care",
    dict: {
      common: { breadcrumbHome: "Home" },
      nav: { products: "Products" }
    }
  }),
  requireStorefrontValue: (value: any) => value,
  StorefrontJsonLd: () => createElement("div", { "data-testid": "json-ld" })
}));

vi.mock("@/lib/seo", () => ({
  buildCategoryMetadata: vi.fn(),
  breadcrumbJsonLd: vi.fn(() => ({}))
}));

vi.mock("@/lib/api/client", () => ({
  fetchCategories: vi.fn(async () => ([
    { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false },
    { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: false },
    { id: 3, parentId: 2, slug: "vitamin-c", name: { ar: "فيتامين سي", en: "Vitamin C" }, isLeaf: true },
    { id: 4, parentId: 1, slug: "cleansers", name: { ar: "منظفات", en: "Cleansers" }, isLeaf: true },
    { id: 5, parentId: null, slug: "body-care", name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: true }
  ])),
  fetchProducts: vi.fn(async () => ([])),
  getCategoryBySlug: vi.fn((categories, slug) => categories.find((category: any) => category.slug === slug)),
  getCategoryPath: vi.fn((categories, id) => {
    const byId = new Map(categories.map((category: any) => [category.id, category]));
    const path = [];
    let current = byId.get(id);
    while (current) {
      path.unshift(current);
      current = current.parentId != null ? byId.get(current.parentId) : undefined;
    }
    return path;
  }),
  getProductsByCategory: vi.fn(() => [])
}));

import CategoryPage from "@/app/[lang]/category/[slug]/page";

describe("category page", () => {
  it("passes the full active subtree into the product grid for deep category browsing", async () => {
    render(await CategoryPage({ params: Promise.resolve({ lang: "en", slug: "skin-care" }) }));

    expect(screen.getByTestId("product-grid")).toHaveTextContent("categories:1,2,3,4");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("initial:1");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("locked:no");
  });
});
