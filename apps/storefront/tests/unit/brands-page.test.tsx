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
      nav: { allBrands: "All Brands" },
      common: { breadcrumbHome: "Home", empty: "Nothing here yet" }
    })
  };
});

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

const brands = vi.hoisted(() => ({ list: [] as any[] }));

vi.mock("@/lib/storefront-static-data", () => ({
  loadBrandsPageData: async () => brands.list
}));

import BrandsPage from "@/app/[lang]/brands/page";

const renderPage = async () => render(await BrandsPage({ params: Promise.resolve({ lang: "en" }) }));

describe("all brands page", () => {
  it("lists every brand that has products, each linking to its page", async () => {
    brands.list = [
      { id: 1, slug: "lego", name: { ar: "ليجو", en: "Lego" }, imagePath: "/uploads/lego.png", hasProducts: true },
      { id: 2, slug: "unused", name: { ar: "غير مستخدم", en: "Unused" }, imagePath: null, hasProducts: false },
      { id: 3, slug: "dolphin", name: { ar: "دولفين", en: "Dolphin" }, imagePath: null, hasProducts: true }
    ];
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "All Brands" })).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "All Brands" });
    const links = Array.from(list.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/en/brands/lego", "/en/brands/dolphin"]);
    expect(screen.getByRole("link", { name: "Lego" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dolphin" })).toBeInTheDocument();
  });

  it("says there is nothing yet when no brand has products", async () => {
    brands.list = [{ id: 2, slug: "unused", name: { ar: "غير مستخدم", en: "Unused" }, imagePath: null, hasProducts: false }];
    await renderPage();

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });
});
