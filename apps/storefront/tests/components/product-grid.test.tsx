import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductGrid } from "@/components/products/product-grid";
import { categories, products } from "@capella/shared/mock";

vi.mock("@/components/products/product-card", () => ({
  ProductCard: ({ product }: { product: { slug: string } }) => createElement("div", { "data-testid": `product-${product.slug}` })
}));

const dict = {
  nav: {
    search: "Search",
    allCategories: "All categories"
  },
  filters: {
    title: "Filters",
    category: "Category",
    price: "Price",
    priceMin: "Min",
    priceMax: "Max",
    sortBy: "Sort by",
    sortNewest: "Newest",
    sortPriceAsc: "Price low to high",
    sortPriceDesc: "Price high to low",
    sortName: "Name"
  },
  common: {
    filters: "Filters",
    clear: "Clear",
    empty: "No products",
    results: "{n} results"
  }
};

describe("ProductGrid", () => {
  const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 120
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
    }
  });

  it("uses logical inline-end padding for the sort select", () => {
    render(createElement(ProductGrid, { products, categories, lang: "en", dict }));

    const select = screen.getByRole("combobox");
    expect(select.style.paddingInlineStart).toBe("12px");
    expect(select.style.paddingInlineEnd).toBe("32px");
    expect(select.style.paddingRight).toBe("");
  });

  it("cancels scheduled animation frame and timeout work when a filter section unmounts", () => {
    let rafId = 0;
    const cancelAnimationFrame = vi.fn();
    const requestAnimationFrame = vi.fn<(callback: FrameRequestCallback) => number>((callback) => {
      rafId += 1;
      callback(0);
      return rafId;
    });

    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = render(createElement(ProductGrid, { products, categories, lang: "en", dict }));
    const initialRafCalls = requestAnimationFrame.mock.calls.length;

    fireEvent.click(screen.getAllByRole("button", { name: "Search" })[0]!);
    unmount();

    expect(requestAnimationFrame.mock.calls.length - initialRafCalls).toBe(2);
    expect(cancelAnimationFrame.mock.calls.some(([id]) => typeof id === "number" && id > 0)).toBe(true);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
