import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("not found"); }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));
vi.mock("@/components/products/grid/product-grid", () => ({
  ProductGrid: ({ products, hiddenAttributeFilters }: any) =>
    createElement("div", { "data-hidden": hiddenAttributeFilters.join(",") }, products.map((p: any) => p.name.en).join("|"))
}));
vi.mock("@/lib/api/client", () => ({
  fetchBrands: vi.fn(async () => [
    { id: 1, slug: "lego", name: { ar: "ليجو", en: "LEGO" }, imagePath: null, hasProducts: true },
    { id: 2, slug: "empty", name: { ar: "فارغ", en: "Empty" }, imagePath: null, hasProducts: false }
  ]),
  fetchCharacters: vi.fn(async () => [
    { id: 7, slug: "batman", name: { ar: "باتمان", en: "Batman" }, imagePath: null, hasProducts: true }
  ]),
  fetchCategories: vi.fn(async () => []),
  fetchProducts: vi.fn(async () => [
    { id: 1, name: { en: "Brick" }, status: "active", brandId: 1, characterIds: [] },
    { id: 2, name: { en: "Bat toy" }, status: "active", brandId: 2, characterIds: [7] },
    { id: 3, name: { en: "Hidden" }, status: "inactive", brandId: 1, characterIds: [7] }
  ])
}));

import BrandPage from "@/app/[lang]/brands/[slug]/page";
import CharacterPage from "@/app/[lang]/characters/[slug]/page";

const params = (slug: string) => ({ params: Promise.resolve({ lang: "en", slug }) });

describe("brand and character pages", () => {
  beforeEach(() => { notFound.mockClear(); });

  it("lists a brand's published products", async () => {
    render(await BrandPage(params("lego")));
    expect(screen.getByRole("heading", { level: 1, name: "LEGO" })).toBeInTheDocument();
    const grid = screen.getByText("Brick");
    expect(grid).toHaveAttribute("data-hidden", "brand");
  });

  it("lists a character's published products", async () => {
    render(await CharacterPage(params("batman")));
    expect(screen.getByRole("heading", { level: 1, name: "Batman" })).toBeInTheDocument();
    expect(screen.getByText("Bat toy")).toHaveAttribute("data-hidden", "character");
  });

  it("says coming soon for a brand with no products yet", async () => {
    render(await BrandPage(params("empty")));
    expect(screen.queryByText("Brick")).toBeNull();
  });

  it("gives not found for an unknown one", async () => {
    await expect(BrandPage(params("nope"))).rejects.toThrow("not found");
  });
});
