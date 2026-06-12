import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileFilterDrawer } from "@/components/products/filters/mobile-filter-drawer";
import type { Category } from "@capella/shared";

const categories: Category[] = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
  { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: true }
];

describe("MobileFilterDrawer", () => {
  it("locks body scroll while open and forwards close actions", () => {
    const onClose = vi.fn();

    const { rerender } = render(createElement(MobileFilterDrawer, {
      open: true,
      onClose,
      lang: "en",
      dict: {
        nav: { search: "Search", allCategories: "All categories" },
        filters: {
          title: "Filters",
          category: "Category",
          price: "Price",
          priceMin: "Min",
          priceMax: "Max",
          closeFilters: "Close filters",
          showResults: "Show results",
          toggleCategory: "Toggle category"
        },
        common: { clear: "Clear" }
      },
      q: "",
      setQ: vi.fn(),
      category: undefined,
      setCategory: vi.fn(),
      priceRange: { min: "", max: "" },
      setPriceRange: vi.fn(),
      categoryTree: [{ category: categories[0], children: [{ category: categories[1], children: [] }] }],
      categories,
      openParents: { 1: true },
      toggleParent: vi.fn(),
      lockCategory: false,
      onClear: vi.fn()
    }));

    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: /close filters/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(createElement(MobileFilterDrawer, {
      open: false,
      onClose,
      lang: "en",
      dict: {
        nav: { search: "Search", allCategories: "All categories" },
        filters: {
          title: "Filters",
          category: "Category",
          price: "Price",
          priceMin: "Min",
          priceMax: "Max",
          closeFilters: "Close filters",
          showResults: "Show results",
          toggleCategory: "Toggle category"
        },
        common: { clear: "Clear" }
      },
      q: "",
      setQ: vi.fn(),
      category: undefined,
      setCategory: vi.fn(),
      priceRange: { min: "", max: "" },
      setPriceRange: vi.fn(),
      categoryTree: [{ category: categories[0], children: [{ category: categories[1], children: [] }] }],
      categories,
      openParents: { 1: true },
      toggleParent: vi.fn(),
      lockCategory: false,
      onClear: vi.fn()
    }));

    expect(document.body.style.overflow).toBe("");
  });

  it("keeps mobile category branches grouped instead of flattening children across parents", () => {
    const { container } = render(createElement(MobileFilterDrawer, {
      open: true,
      onClose: vi.fn(),
      lang: "en",
      dict: {
        brand: "Capella",
        nav: { search: "Search", allCategories: "All categories" },
        filters: {
          title: "Filters",
          category: "Category",
          price: "Price",
          priceMin: "Min",
          priceMax: "Max",
          closeFilters: "Close filters",
          showResults: "Show results",
          toggleCategory: "Toggle category",
          bytype: "By type",
          to: "to"
        },
        common: { clear: "Clear" }
      },
      q: "",
      setQ: vi.fn(),
      category: undefined,
      setCategory: vi.fn(),
      priceRange: { min: "", max: "" },
      setPriceRange: vi.fn(),
      categoryTree: [{
        category: categories[0],
        children: [{ category: categories[1], children: [] }]
      }],
      categories,
      openParents: { 1: true },
      toggleParent: vi.fn(),
      lockCategory: false,
      onClear: vi.fn()
    }));

    expect(container.querySelector('div[style*="display: contents"]')).toBeNull();
  });
});
