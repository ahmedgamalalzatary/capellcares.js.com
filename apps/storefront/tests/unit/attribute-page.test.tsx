import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("not found"); }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));
vi.mock("@/components/products/grid/product-grid", () => ({
  ProductGrid: ({ products, hiddenAttributeFilters }: any) =>
    createElement("div", { "data-testid": "grid", "data-hidden": hiddenAttributeFilters.join(",") }, products.map((p: any) => p.name.en).join("|"))
}));
vi.mock("@/lib/api/client", () => ({
  fetchBrands: vi.fn(async () => [
    { id: 1, slug: "lego", name: { ar: "ليجو", en: "LEGO" }, imagePath: null, hasProducts: true },
    { id: 2, slug: "empty", name: { ar: "فارغ", en: "Empty" }, imagePath: null, hasProducts: false }
  ]),
  fetchCategories: vi.fn(async () => []),
  fetchProducts: vi.fn(async () => [
    { id: 1, name: { en: "Brick" }, status: "active", brandId: 1 },
    { id: 2, name: { en: "Doll" }, status: "active", brandId: 3 },
    { id: 3, name: { en: "Hidden" }, status: "inactive", brandId: 1 }
  ])
}));

import BrandPage from "@/app/[lang]/brands/[slug]/page";

const params = (slug: string) => ({ params: Promise.resolve({ lang: "en", slug }) });

describe("brand pages", () => {
  it("lists a brand's published products", async () => {
    render(await BrandPage(params("lego")));
    expect(screen.getByRole("heading", { name: "LEGO" })).toBeInTheDocument();
    const grid = screen.getByTestId("grid");
    expect(grid).toHaveTextContent("Brick");
    expect(grid).not.toHaveTextContent("Doll");
    expect(grid).not.toHaveTextContent("Hidden");
    expect(grid).toHaveAttribute("data-hidden", "brand");
  });

  it("says coming soon for a brand with no products yet", async () => {
    render(await BrandPage(params("empty")));
    expect(screen.queryByTestId("grid")).toBeNull();
  });

  it("is not found for an unknown brand", async () => {
    await expect(BrandPage(params("nope"))).rejects.toThrow("not found");
  });
});
