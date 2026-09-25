import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { getCategoryById, getCategoryPath, getOffersForProduct } from "@/lib/api/client/selectors";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

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

vi.mock("@/components/products/product-detail", () => ({
  ProductDetail: () => createElement("div", { "data-testid": "product-detail" })
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

vi.mock("@/lib/storefront-detail-page", () => ({
  resolveStorefrontSlugPageContext: async () => ({
    lang: "en",
    slug: "rose-serum",
    dict: {
      common: { breadcrumbHome: "Home" },
      nav: { products: "Products" }
    }
  }),
  requireStorefrontValue: (value: any) => value,
  StorefrontJsonLd: () => createElement("div", { "data-testid": "json-ld" })
}));

vi.mock("@/lib/seo", () => ({
  buildProductsMetadata: vi.fn(),
  buildProductMetadata: vi.fn(),
  breadcrumbJsonLd: vi.fn(() => ({})),
  productJsonLd: vi.fn(() => ({}))
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
  fetchAdvices: vi.fn(async () => ([])),
  fetchOffers: vi.fn(async () => ([])),
  fetchProductBySlug: vi.fn(async () => ({ id: 101, status: "active" })),
  fetchProductDetailBySlug: vi.fn(async () => ({
    id: 101,
    status: "active",
    deletedAt: null,
    slug: "rose-serum",
    name: { en: "Rose Serum", ar: "سيروم الورد" },
    categoryId: 2,
    variants: [],
    relatedItems: []
  })),
  getCategoryById,
  getCategoryBySlug: vi.fn((categories, slug) => {
    const matches = categories.filter((category: any) => category.slug === slug);
    return matches.length === 1 ? matches[0] : undefined;
  }),
  getCategoryPath,
  getOffersForProduct
}));

import ProductsPage from "@/app/[lang]/products/page";
import ProductDetailsPage from "@/app/[lang]/products/[slug]/page";
import { fetchProducts } from "@/lib/api/client";
import { breadcrumbJsonLd } from "@/lib/seo";

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

describe("product detail page breadcrumb", () => {
  it("links each category crumb with its categoryId so the category page resolves the right branch", async () => {
    render(await ProductDetailsPage({
      params: Promise.resolve({ lang: "en", slug: "rose-serum" })
    }));

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/en/shop");
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/en/products");
    expect(screen.getByRole("link", { name: "Care" })).toHaveAttribute(
      "href",
      "/en/category/care?categoryId=1"
    );
    expect(screen.getByRole("link", { name: "Serums" })).toHaveAttribute(
      "href",
      "/en/category/serums?categoryId=2"
    );
    expect(screen.queryByRole("link", { name: "Rose Serum" })).toBeNull();
    expect(screen.getByText("Rose Serum")).toBeInTheDocument();
  });

  it("emits the same categoryId-scoped urls in the breadcrumb JSON-LD", async () => {
    render(await ProductDetailsPage({
      params: Promise.resolve({ lang: "en", slug: "rose-serum" })
    }));

    expect(breadcrumbJsonLd).toHaveBeenCalledWith([
      { name: "Home", url: "/en/shop" },
      { name: "Products", url: "/en/products" },
      { name: "Care", url: "/en/category/care?categoryId=1" },
      { name: "Serums", url: "/en/category/serums?categoryId=2" },
      { name: "Rose Serum" }
    ]);
  });
});
