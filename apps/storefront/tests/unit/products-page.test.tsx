import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@capella/shared", async () => {
  const actual = await vi.importActual<any>("@capella/shared");
  return {
    ...actual,
    getDict: () => ({
      common: { breadcrumbHome: "Home" },
      nav: { products: "Products" }
    })
  };
});

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: ({ items }: any) => createElement("nav", null, items.map((item: any) => item.label).join(" / "))
}));

vi.mock("@/components/products/advice-section", () => ({
  AdviceSection: () => createElement("section", null, "Advice")
}));

vi.mock("@/components/products/grid/product-grid", () => ({
  ProductGrid: ({ products, initialCategory, initialSearch }: any) =>
    createElement(
      "div",
      { "data-testid": "product-grid" },
      `products:${products.map((product: any) => product.id).join(",")};initial:${initialCategory ?? "none"};search:${initialSearch ?? ""}`
    )
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

vi.mock("@/lib/seo", () => ({
  buildProductsMetadata: vi.fn()
}));

vi.mock("@/lib/api/client", () => ({
  fetchProducts: vi.fn(async () => ([
    { id: 2, status: "active" },
    { id: 1, status: "active" }
  ])),
  fetchCategories: vi.fn(async () => ([
    { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
    { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: true }
  ])),
  fetchAdvices: vi.fn(async () => ([]))
}));

import ProductsPage from "@/app/[lang]/products/page";
import { fetchProducts } from "@/lib/api/client";

describe("products page", () => {
  it("fetches category-scoped products from the API when a category id filter is present", async () => {
    render(await ProductsPage({
      params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ q: "rose", categoryId: "2" })
    }));

    expect(fetchProducts).toHaveBeenCalledWith({ lang: "en", category: undefined, categoryId: "2" });
    expect(screen.getByTestId("product-grid")).toHaveTextContent("products:2,1");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("initial:2");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("search:rose");
  });

  it("falls back to slug-based category lookup when categoryId is invalid", async () => {
    render(await ProductsPage({
      params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({ category: "serums", categoryId: "abc" })
    }));

    expect(fetchProducts).toHaveBeenCalledWith({ lang: "en", category: "serums", categoryId: "abc" });
    expect(screen.getByTestId("product-grid")).toHaveTextContent("initial:2");
  });
});
