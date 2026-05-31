import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@capella/shared";
import { ProductFilterCategoryList } from "@/components/products/filters/product-filter-category-list";

const categories: Category[] = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
  { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: true },
  { id: 3, parentId: null, slug: "body", name: { ar: "الجسم", en: "Body" }, isLeaf: true }
];

describe("ProductFilterCategoryList", () => {
  it("renders shared desktop category tree controls and forwards selection", () => {
    const setCategory = vi.fn();
    const toggleParent = vi.fn();

    render(createElement(ProductFilterCategoryList, {
      mode: "desktop",
      lang: "en",
      dict: {
        nav: { allCategories: "All categories" },
        filters: { toggleCategory: "Toggle category" }
      },
      category: 2,
      setCategory,
      categories,
      categoryTree: [{ parent: categories[0], children: [categories[1]] }],
      openParents: { 1: true },
      toggleParent
    }));

    expect(screen.getByText("All categories")).toBeInTheDocument();
    expect(screen.getByText("Care")).toBeInTheDocument();
    expect(screen.getByText("Serums")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle category" }));
    expect(toggleParent).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText("All categories"));
    expect(setCategory).toHaveBeenCalledWith(undefined);
  });

  it("renders shared mobile category tree controls", () => {
    render(createElement(ProductFilterCategoryList, {
      mode: "mobile",
      lang: "en",
      dict: {
        nav: { allCategories: "All categories" },
        filters: { toggleCategory: "Toggle category" }
      },
      category: undefined,
      setCategory: vi.fn(),
      categories,
      categoryTree: [{ parent: categories[0], children: [categories[1]] }],
      openParents: { 1: true },
      toggleParent: vi.fn()
    }));

    expect(screen.getByText("All categories")).toBeInTheDocument();
    expect(screen.getByText("Care")).toBeInTheDocument();
    expect(screen.getByText("Serums")).toBeInTheDocument();
  });

  it("renders fallback categories when no category tree is available", () => {
    render(createElement(ProductFilterCategoryList, {
      mode: "desktop",
      lang: "en",
      dict: {
        nav: { allCategories: "All categories" },
        filters: { toggleCategory: "Toggle category" }
      },
      category: 3,
      setCategory: vi.fn(),
      categories,
      categoryTree: [],
      openParents: {},
      toggleParent: vi.fn()
    }));

    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle category" })).not.toBeInTheDocument();
  });
});
