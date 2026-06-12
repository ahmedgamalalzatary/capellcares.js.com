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
    slug: "curly-hair",
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
    { id: 8, parentId: null, slug: "hair-care", name: { ar: "الشعر", en: "Hair Care" }, isLeaf: false },
    { id: 59, parentId: 8, slug: "hair-tonic", name: { ar: "تونك الشعر", en: "Hair Tonic" }, isLeaf: false },
    { id: 62, parentId: 59, slug: "curly-hair", name: { ar: "الشعر المجعد", en: "Curly Hair" }, isLeaf: true },
    { id: 69, parentId: 8, slug: "conditioner", name: { ar: "بلسم", en: "Conditioner" }, isLeaf: false },
    { id: 72, parentId: 69, slug: "curly-hair", name: { ar: "الشعر المجعد", en: "Curly Hair" }, isLeaf: true }
  ])),
  fetchProducts: vi.fn(async () => ([])),
  getCategoryById: vi.fn((categories, id) => categories.find((category: any) => category.id === id)),
  getCategoryBySlug: vi.fn((categories, slug) => categories.find((category: any) => category.slug === slug)),
  getCategoryPath: vi.fn((categories, id) => {
    const byId = new Map(categories.map((category: any) => [category.id, category]));
    const path = [];
    let current: any = byId.get(id);
    while (current) {
      path.unshift(current);
      current = current.parentId != null ? byId.get(current.parentId) : undefined;
    }
    return path;
  })
}));

import CategoryPage from "@/app/[lang]/category/[slug]/page";
import { fetchProducts } from "@/lib/api/client";

describe("category page", () => {
  it("resolves duplicate slugs by categoryId and keeps links scoped to that branch", async () => {
    render(await CategoryPage({
      params: Promise.resolve({ lang: "en", slug: "curly-hair" }),
      searchParams: Promise.resolve({ categoryId: "62" })
    }));

    expect(fetchProducts).toHaveBeenCalledWith({ lang: "en", category: "curly-hair", categoryId: "62" });
    expect(screen.getByText("Home / Products / Hair Care / Hair Tonic / Curly Hair")).toBeInTheDocument();
    expect(screen.getByTestId("product-grid")).toHaveTextContent("categories:62");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("initial:62");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("locked:no");
  });

  it("falls back to slug lookup when categoryId is invalid", async () => {
    render(await CategoryPage({
      params: Promise.resolve({ lang: "en", slug: "curly-hair" }),
      searchParams: Promise.resolve({ categoryId: "abc" })
    }));

    expect(fetchProducts).toHaveBeenCalledWith({ lang: "en", category: "curly-hair", categoryId: "abc" });
    expect(screen.getByText("Home / Products / Hair Care / Hair Tonic / Curly Hair")).toBeInTheDocument();
    expect(screen.getByTestId("product-grid")).toHaveTextContent("initial:62");
  });
});
