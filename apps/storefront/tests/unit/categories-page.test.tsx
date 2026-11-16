import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, fill, sizes, priority, ...rest }: any) => createElement("img", { alt, src, ...rest })
}));

vi.mock("@capella/shared", async () => {
  const actual = await vi.importActual<any>("@capella/shared");
  return {
    ...actual,
    getDict: () => ({
      nav: { allCategories: "All Categories" },
      common: { breadcrumbHome: "Home", empty: "Nothing here yet" }
    })
  };
});

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

const categories = vi.hoisted(() => ({ list: [] as any[] }));

vi.mock("@/lib/storefront-static-data", () => ({
  loadCategoriesPageData: async () => categories.list
}));

import CategoriesPage from "@/app/[lang]/categories/page";

const renderPage = async () => render(await CategoriesPage({ params: Promise.resolve({ lang: "en" }) }));

describe("all categories page", () => {
  it("lists only main categories that have a picture, each linking to its page", async () => {
    categories.list = [
      { id: 1, parentId: null, slug: "building", name: { ar: "تركيب", en: "Building" }, imagePath: "/uploads/building.jpg", hasProducts: true },
      { id: 2, parentId: 1, slug: "bricks", name: { ar: "مكعبات", en: "Bricks" }, imagePath: "/uploads/bricks.jpg", hasProducts: true },
      { id: 3, parentId: null, slug: "dolls", name: { ar: "عرائس", en: "Dolls" }, imagePath: null, hasProducts: true },
      { id: 4, parentId: null, slug: "empty", name: { ar: "فارغ", en: "Empty" }, imagePath: "/uploads/empty.jpg", hasProducts: false },
      { id: 5, parentId: null, slug: "gone", name: { ar: "محذوف", en: "Gone" }, imagePath: "/uploads/gone.jpg", hasProducts: true, deletedAt: "2026-01-01" },
      { id: 6, parentId: null, slug: "pools", name: { ar: "مسابح", en: "Pools" }, imagePath: "/uploads/pools.jpg", hasProducts: true }
    ];
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "All Categories" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "All Categories" });
    const links = Array.from(list.querySelectorAll("a"));
    expect(links.map((link) => link.textContent)).toEqual(["Building", "Pools"]);
    expect(links[0]).toHaveAttribute("href", "/en/category/building?categoryId=1");
    expect(links[0].querySelector("img")).toHaveAttribute("src", "/uploads/building.jpg");
  });

  it("says there is nothing yet when no main category has a picture", async () => {
    categories.list = [
      { id: 3, parentId: null, slug: "dolls", name: { ar: "عرائس", en: "Dolls" }, imagePath: null, hasProducts: true }
    ];
    await renderPage();

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "All Categories" })).toBeNull();
  });
});
