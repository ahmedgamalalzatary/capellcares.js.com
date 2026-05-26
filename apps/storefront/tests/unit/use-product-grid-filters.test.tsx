import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useProductGridFilters } from "@/components/products/use-product-grid-filters";
import type { Category, Product } from "@capella/shared";

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
  { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: true },
  { id: 3, parentId: 1, slug: "balms", name: { ar: "بلسم", en: "Balms" }, isLeaf: true }
];

function HookProbe() {
  const grid = useProductGridFilters({
    products,
    categories,
    lang: "en",
    initialSearch: "",
    initialCategory: 1
  });

  return createElement(
    "div",
    null,
    createElement("button", { onClick: () => grid.setQ("rose") }, "search"),
    createElement("button", { onClick: () => grid.setSort("price-desc") }, "sort-desc"),
    createElement("button", { onClick: () => grid.setPriceRange({ min: "200", max: "230" }) }, "price-range"),
    createElement("button", { onClick: () => grid.handleClear() }, "clear"),
    createElement("div", null, `ids:${grid.filtered.map((product) => product.id).join(",")}`),
    createElement("div", null, `tree:${grid.categoryTree.map((item) => `${item.parent.id}:${item.children.length}`).join(",")}`),
    createElement("div", null, `active:${grid.hasActiveFilters ? "yes" : "no"}`),
    createElement("div", null, `selected:${grid.category ?? "none"}`)
  );
}

describe("useProductGridFilters", () => {
  it("builds the category tree and filters descendants from the initial category", () => {
    render(createElement(HookProbe));

    expect(screen.getByText("ids:2,1")).toBeInTheDocument();
    expect(screen.getByText("tree:1:2")).toBeInTheDocument();
    expect(screen.getByText("selected:1")).toBeInTheDocument();
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
    expect(await screen.findByText("ids:2,1")).toBeInTheDocument();
    expect(screen.getByText("selected:1")).toBeInTheDocument();
    expect(screen.getByText("active:no")).toBeInTheDocument();
  });
});
