import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Category } from "@capella/shared";
import { ProductFilterCategoryList } from "@/components/products/filters/product-filter-category-list";

const categories: Category[] = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
  { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: false },
  { id: 4, parentId: 2, slug: "vitamin-c", name: { ar: "فيتامين سي", en: "Vitamin C" }, isLeaf: true },
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
      categoryTree: [{ category: categories[0], children: [{ category: categories[1], children: [{ category: categories[2], children: [] }] }] }],
      openParents: { 1: true },
      toggleParent
    }));

    expect(screen.getByText("All categories")).toBeInTheDocument();
    expect(screen.getByText("Care")).toBeInTheDocument();
    expect(screen.getByText("Serums")).toBeInTheDocument();
    expect(screen.getByText("Vitamin C")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Toggle category" })[0]);
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
      categoryTree: [{ category: categories[0], children: [{ category: categories[1], children: [{ category: categories[2], children: [] }] }] }],
      openParents: { 1: true, 2: true },
      toggleParent: vi.fn()
    }));

    expect(screen.getByText("All categories")).toBeInTheDocument();
    expect(screen.getByText("Care")).toBeInTheDocument();
    expect(screen.getByText("Serums")).toBeInTheDocument();
    expect(screen.getByText("Vitamin C")).toBeInTheDocument();
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

  it("labels the scoped root pill after its category and drops the generic all-categories pill", () => {
    render(createElement(ProductFilterCategoryList, {
      mode: "desktop",
      lang: "en",
      dict: {
        nav: { allCategories: "All categories", allCategoryTypes: "All {name} Types" },
        filters: { toggleCategory: "Toggle category" }
      },
      category: 1,
      setCategory: vi.fn(),
      categories,
      categoryTree: [{ category: categories[0], children: [{ category: categories[1], children: [] }] }],
      openParents: { 1: true },
      toggleParent: vi.fn(),
      scopedCategoryId: 1
    }));

    expect(screen.getByText("All Care Types")).toBeInTheDocument();
    expect(screen.queryByText("All categories")).not.toBeInTheDocument();
    // The scoped root is represented only by the renamed pill, never twice.
    expect(screen.queryByText("Care")).not.toBeInTheDocument();
    // Its children still render underneath it.
    expect(screen.getByText("Serums")).toBeInTheDocument();
  });

  it("selects the scoped category instead of clearing when its pill is clicked", () => {
    const setCategory = vi.fn();

    render(createElement(ProductFilterCategoryList, {
      mode: "mobile",
      lang: "en",
      dict: {
        nav: { allCategories: "All categories", allCategoryTypes: "All {name} Types" },
        filters: { toggleCategory: "Toggle category" }
      },
      category: 2,
      setCategory,
      categories,
      categoryTree: [{ category: categories[0], children: [{ category: categories[1], children: [] }] }],
      openParents: { 1: true },
      toggleParent: vi.fn(),
      scopedCategoryId: 1
    }));

    fireEvent.click(screen.getByText("All Care Types"));
    expect(setCategory).toHaveBeenCalledWith(1);
  });

  it("keeps the generic all-categories pill when the scoped category is not a tree root", () => {
    render(createElement(ProductFilterCategoryList, {
      mode: "desktop",
      lang: "en",
      dict: {
        nav: { allCategories: "All categories", allCategoryTypes: "All {name} Types" },
        filters: { toggleCategory: "Toggle category" }
      },
      category: 2,
      setCategory: vi.fn(),
      categories,
      categoryTree: [
        { category: categories[0], children: [{ category: categories[1], children: [] }] },
        { category: categories[3], children: [] }
      ],
      openParents: { 1: true },
      toggleParent: vi.fn(),
      // Serums is nested, not a root of the rendered tree.
      scopedCategoryId: 2
    }));

    expect(screen.getByText("All categories")).toBeInTheDocument();
    expect(screen.queryByText("All Serums Types")).not.toBeInTheDocument();
    expect(screen.getByText("Care")).toBeInTheDocument();
    expect(screen.getByText("Serums")).toBeInTheDocument();
  });
});
