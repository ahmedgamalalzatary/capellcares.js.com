import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterDrawer } from "@/components/products/filters/filter-drawer";
import type { Category } from "@capella/shared";

const categories: Category[] = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
  { id: 2, parentId: 1, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: true }
];

describe("FilterDrawer", () => {
  it("locks body scroll while open and forwards close actions", () => {
    const onClose = vi.fn();

    const { rerender } = render(createElement(FilterDrawer, {
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

    rerender(createElement(FilterDrawer, {
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
    const { container } = render(createElement(FilterDrawer, {
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

  const modalDict = {
    brand: "Capella",
    nav: { search: "Search", allCategories: "All categories" },
    filters: {
      title: "Filters",
      price: "Price",
      priceMin: "Min",
      priceMax: "Max",
      closeFilters: "Close filters",
      dismissFilters: "Dismiss filters",
      showResults: "Show results",
      toggleCategory: "Toggle category",
      bytype: "By type",
      to: "to"
    },
    common: { clear: "Clear" }
  };

  const modalProps = (open: boolean, onClose: () => void = vi.fn()) => ({
    open,
    onClose,
    lang: "en" as const,
    dict: modalDict,
    q: "",
    setQ: vi.fn(),
    category: undefined,
    setCategory: vi.fn(),
    priceRange: { min: "", max: "" },
    setPriceRange: vi.fn(),
    categoryTree: [{ category: categories[0]!, children: [{ category: categories[1]!, children: [] }] }],
    categories,
    openParents: { 1: true },
    toggleParent: vi.fn(),
    lockCategory: false,
    onClear: vi.fn()
  });

  const withTrigger = (open: boolean, onClose?: () => void) =>
    createElement(
      "div",
      null,
      createElement("button", { type: "button", "data-testid": "trigger" }, "Open filters"),
      createElement(FilterDrawer, modalProps(open, onClose))
    );

  it("names the backdrop distinctly instead of leaving it an unnamed button", () => {
    render(createElement(FilterDrawer, modalProps(true)));

    expect(screen.getByRole("button", { name: "Dismiss filters" })).toBeInTheDocument();
    // Not the same name as the close control, or it reads as a duplicate.
    expect(screen.getAllByRole("button", { name: "Close filters" })).toHaveLength(1);
  });

  it("keeps the closed drawer and its controls out of the tab order", () => {
    const { rerender } = render(createElement(FilterDrawer, modalProps(false)));

    expect(screen.getByRole("dialog", { hidden: true })).toHaveAttribute("inert");

    rerender(createElement(FilterDrawer, modalProps(true)));

    expect(screen.getByRole("dialog")).not.toHaveAttribute("inert");
  });

  it("moves focus into the drawer when it opens and back to the trigger when it closes", () => {
    const { rerender } = render(withTrigger(false));

    screen.getByTestId("trigger").focus();
    expect(screen.getByTestId("trigger")).toHaveFocus();

    rerender(withTrigger(true));
    expect(screen.getByRole("button", { name: "Close filters", hidden: true })).toHaveFocus();

    rerender(withTrigger(false));
    expect(screen.getByTestId("trigger")).toHaveFocus();
  });

  it("closes on Escape while open and stays put while closed", () => {
    const onClose = vi.fn();
    const { rerender } = render(createElement(FilterDrawer, modalProps(false, onClose)));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    rerender(createElement(FilterDrawer, modalProps(true, onClose)));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the drawer while it is open", () => {
    render(createElement(FilterDrawer, modalProps(true)));

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>("button, input, a[href]");
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("forwards the scoped category down to the category list", () => {
    render(createElement(FilterDrawer, {
      open: true,
      onClose: vi.fn(),
      lang: "en",
      dict: {
        brand: "Capella",
        nav: { search: "Search", allCategories: "All categories", allCategoryTypes: "All {name} Types" },
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
      category: 1,
      setCategory: vi.fn(),
      priceRange: { min: "", max: "" },
      setPriceRange: vi.fn(),
      categoryTree: [{ category: categories[0], children: [{ category: categories[1], children: [] }] }],
      categories,
      openParents: { 1: true },
      toggleParent: vi.fn(),
      lockCategory: false,
      onClear: vi.fn(),
      scopedCategoryId: 1
    }));

    expect(screen.getByText("All Care Types")).toBeInTheDocument();
    expect(screen.queryByText("All categories")).not.toBeInTheDocument();
  });
});
