import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capella/shared", async () => {
  const actual = await vi.importActual<any>("@capella/shared");
  return {
    ...actual,
    getDict: () => ({
      common: { breadcrumbHome: "Home" },
      nav: { bestsellers: "Bestsellers", new: "New" },
      shop: { bestsellers: "Bestsellers", new: "New" }
    })
  };
});

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: ({ items }: any) => createElement("nav", null, items.map((item: any) => item.label).join(" / "))
}));

vi.mock("@/components/products/grid/product-grid", () => ({
  ProductGrid: ({ products, categories }: any) =>
    createElement("div", { "data-testid": "product-grid" }, `products:${products.map((product: any) => product.id).join(",")};categories:${categories.length}`)
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

const { fetchProducts, fetchCategories } = vi.hoisted(() => ({
  fetchProducts: vi.fn(async () => ([
    { id: 1, status: "active", deletedAt: null, isBestseller: true, isNew: false },
    { id: 2, status: "active", deletedAt: null, isBestseller: false, isNew: true }
  ])),
  fetchCategories: vi.fn(async () => ([
    { id: 1, deletedAt: null }
  ]))
}));

vi.mock("@/lib/api/client", () => ({
  fetchProducts,
  fetchCategories
}));

import BestsellersPage from "@/app/[lang]/bestsellers/page";
import NewProductsPage from "@/app/[lang]/new/page";

describe("listing pages", () => {
  beforeEach(() => {
    fetchProducts.mockClear();
    fetchCategories.mockClear();
  });

  it("renders bestsellers even if categories loading fails", async () => {
    fetchCategories.mockRejectedValueOnce(new Error("offline"));

    render(await BestsellersPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByTestId("product-grid")).toHaveTextContent("products:1");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("categories:0");
  });

  it("renders new products even if categories loading fails", async () => {
    fetchCategories.mockRejectedValueOnce(new Error("offline"));

    render(await NewProductsPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByTestId("product-grid")).toHaveTextContent("products:2");
    expect(screen.getByTestId("product-grid")).toHaveTextContent("categories:0");
  });
});
