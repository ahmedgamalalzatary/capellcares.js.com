import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductGridToolbar } from "@/components/products/grid/product-grid-toolbar";

describe("ProductGridToolbar", () => {
  it("renders the result count and forwards sort and filter actions", () => {
    const onOpenFilters = vi.fn();
    const onSortChange = vi.fn();

    render(createElement(ProductGridToolbar, {
      dict: {
        common: {
          filters: "Filters",
          results: "{n} results"
        },
        filters: {
          sortBy: "Sort by",
          sortFeatured: "Featured",
          sortNewest: "Newest",
          sortPriceAsc: "Price low to high",
          sortPriceDesc: "Price high to low",
          sortName: "Name"
        }
      },
      filteredCount: 7,
      hasActiveFilters: true,
      sort: "default",
      onOpenFilters,
      onSortChange
    }));

    expect(screen.getByText("7 results")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    expect(onOpenFilters).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "price-desc" } });
    expect(onSortChange).toHaveBeenCalledWith("price-desc");
  });
});
