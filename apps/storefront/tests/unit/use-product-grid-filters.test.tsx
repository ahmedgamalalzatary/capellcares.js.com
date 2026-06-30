import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { useProductGridFilters } from "@/hooks/use-product-grid-filters";
import type { Category, Product } from "@capella/shared";

const replace = vi.fn();
let pathname = "/en/products";
let currentSearchParams = new URLSearchParams("categoryId=1");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
  useSearchParams: () => currentSearchParams
}));

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
    isNew: true,
    isBestseller: false,
    categoryId: 2,
    variants: [{ id: 11, productId: 1, size: "30ml", price: 220, stock: 4 }],
    createdAt: "",
    updatedAt: ""
  },
  {
    id: 2,
    sku: "BALM-1",
    slug: "night-balm",
    name: { ar: "بلسم الليل", en: "Night Balm" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 80,
    imagePath: "/balm.png",
    status: "active",
    isNew: false,
    isBestseller: true,
    categoryId: 3,
    variants: [{ id: 21, productId: 2, size: "50ml", price: 140, stock: 3 }],
    createdAt: "",
    updatedAt: ""
  }
];

const categories: Category[] = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
  { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: false },
  { id: 4, parentId: 2, slug: "vitamin-c", name: { ar: "فيتامين سي", en: "Vitamin C" }, isLeaf: true },
  { id: 3, parentId: 1, slug: "balms", name: { ar: "بلسم", en: "Balms" }, isLeaf: true }
];

const categoryPageSubtreeCategories: Category[] = [
  { id: 102, parentId: 101, slug: "oily-skin", name: { ar: "بشرة دهنية", en: "Oily Skin" }, isLeaf: true, sortOrder: 1 },
  { id: 101, parentId: 99, slug: "skin-cream", name: { ar: "كريم البشرة", en: "Skin Cream" }, isLeaf: true, sortOrder: 2 },
  { id: 103, parentId: 101, slug: "dry-skin", name: { ar: "بشرة جافة", en: "Dry Skin" }, isLeaf: true, sortOrder: 3 }
];

interface HookProbeProps {
  categoryInput?: Category[];
  initialCategory?: number;
}

function HookProbe({ categoryInput = categories, initialCategory = 1 }: HookProbeProps) {
  const [headerCategoryIds, setHeaderCategoryIds] = useState<number[]>([]);
  const grid = useProductGridFilters({
    products,
    categories: categoryInput,
    lang: "en",
    initialSearch: "",
    initialCategory,
    headerCategoryIds,
    onHeaderCategoryIdsChange: setHeaderCategoryIds
  });

  return createElement(
    "div",
    null,
    createElement("button", { onClick: () => grid.setQ("rose") }, "search"),
    createElement("button", { onClick: () => grid.setSort("price-desc") }, "sort-desc"),
    createElement("button", { onClick: () => grid.setSort("newest") }, "sort-newest"),
    createElement("button", { onClick: () => grid.setCategory(2) }, "category-serums"),
    createElement("button", { onClick: () => grid.setCategory(undefined) }, "category-all"),
    createElement("button", { onClick: () => grid.setPriceRange({ min: "200", max: "230" }) }, "price-range"),
    createElement("button", { onClick: () => grid.setHeaderCategoryIds([2, 3]) }, "header-categories"),
    createElement("button", { onClick: () => grid.setHeaderCategoryIds([]) }, "header-clear"),
    createElement("button", { onClick: () => grid.handleClear() }, "clear"),
    createElement("div", null, `ids:${grid.filtered.map((product) => product.id).join(",")}`),
    createElement("div", null, `tree:${grid.categoryTree.map((item) => `${item.category.id}:${item.children.length}:${item.children[0]?.children.length ?? 0}`).join(",")}`),
    createElement("div", null, `tree-order:${grid.categoryTree.map((item) => [item.category.id, ...item.children.map((child) => child.category.id)].join(">")).join("|")}`),
    createElement("div", null, `active:${grid.hasActiveFilters ? "yes" : "no"}`),
    createElement("div", null, `selected:${grid.category ?? "none"}`),
    createElement("div", null, `header:${grid.headerCategoryIds?.join(",") || "none"}`)
  );
}

describe("useProductGridFilters", () => {
  beforeEach(() => {
    replace.mockReset();
    pathname = "/en/products";
    currentSearchParams = new URLSearchParams("categoryId=1");
  });

  it("preserves the incoming API order by default", () => {
    render(createElement(HookProbe));

    expect(screen.getByText("ids:1,2")).toBeInTheDocument();
  });

  it("builds the category tree and filters descendants from the initial category", () => {
    render(createElement(HookProbe));

    expect(screen.getByText("ids:1,2")).toBeInTheDocument();
    expect(screen.getByText("tree:1:2:1")).toBeInTheDocument();
    expect(screen.getByText("selected:1")).toBeInTheDocument();
  });

  it("roots category-page subtrees at the current category and sorts descendants by category order", () => {
    render(createElement(HookProbe, { categoryInput: categoryPageSubtreeCategories, initialCategory: 101 }));

    expect(screen.getByText("tree:101:2:0")).toBeInTheDocument();
    expect(screen.getByText("tree-order:101>102>103")).toBeInTheDocument();
  });

  it("updates search, sort, and price filters through the returned state actions", async () => {
    render(createElement(HookProbe));

    screen.getByText("search").click();
    expect(await screen.findByText("ids:1")).toBeInTheDocument();

    screen.getByText("sort-desc").click();
    expect(await screen.findByText("ids:1")).toBeInTheDocument();

    screen.getByText("price-range").click();
    expect(await screen.findByText("ids:1")).toBeInTheDocument();
    expect(screen.getByText("active:yes")).toBeInTheDocument();
  });

  it("clears filters back to the initial category", async () => {
    render(createElement(HookProbe));

    screen.getByText("search").click();
    expect(await screen.findByText("active:yes")).toBeInTheDocument();

    screen.getByText("clear").click();
    expect(await screen.findByText("ids:1,2")).toBeInTheDocument();
    expect(screen.getByText("selected:1")).toBeInTheDocument();
    expect(screen.getByText("active:no")).toBeInTheDocument();
  });

  it("still lets the shopper switch to newest-first explicitly", async () => {
    render(createElement(HookProbe));

    screen.getByText("sort-newest").click();
    expect(await screen.findByText("ids:2,1")).toBeInTheDocument();
  });

  it("updates the products page URL when the shopper changes category", async () => {
    render(createElement(HookProbe));

    screen.getByText("category-serums").click();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/en/products?categoryId=2", { scroll: false });
    });
  });

  it("removes the category query when the shopper clears category filtering", async () => {
    render(createElement(HookProbe));

    screen.getByText("category-all").click();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/en/products", { scroll: false });
    });
  });

  it("lets header category pills filter by multiple categories and deactivate on second click", async () => {
    render(createElement(HookProbe));

    screen.getByText("header-categories").click();

    expect(await screen.findByText("ids:1,2")).toBeInTheDocument();
    expect(screen.getByText("header:2,3")).toBeInTheDocument();

    screen.getByText("header-clear").click();

    expect(await screen.findByText("header:none")).toBeInTheDocument();
    expect(screen.getByText("ids:1,2")).toBeInTheDocument();
  });

  it("clears header category pills when a main filter becomes active", async () => {
    render(createElement(HookProbe));

    screen.getByText("header-categories").click();
    expect(await screen.findByText("header:2,3")).toBeInTheDocument();

    screen.getByText("search").click();

    expect(await screen.findByText("header:none")).toBeInTheDocument();
    expect(screen.getByText("ids:1")).toBeInTheDocument();
  });

});
