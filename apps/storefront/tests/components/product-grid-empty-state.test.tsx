import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductGridEmptyState } from "@/components/products/product-grid-empty-state";

describe("ProductGridEmptyState", () => {
  it("renders the empty state copy and clear button when filters are active", () => {
    const onClear = vi.fn();

    render(createElement(ProductGridEmptyState, {
      lang: "en",
      dict: {
        common: { empty: "Nothing found", clear: "Clear" },
        filters: { emptyDesc: "Try adjusting your filters or search for something else." }
      },
      hasActiveFilters: true,
      onClear
    }));

    expect(screen.getByText("Nothing found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filters or search for something else.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
