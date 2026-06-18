import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopCardRow } from "@/components/shop/shop-card-row";

function getScroller(container: HTMLElement): HTMLElement {
  // first child of the relative wrapper is the scrolling row
  return container.firstElementChild!.firstElementChild as HTMLElement;
}

describe("ShopCardRow", () => {
  it("wraps each child in its own fixed-width snap item", () => {
    const { container } = render(
      createElement(
        ShopCardRow,
        null,
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "b" }, "B"),
        createElement("span", { key: "c" }, "C")
      )
    );

    const scroller = getScroller(container);
    expect(scroller.children).toHaveLength(3);
    expect(screen.getByText("A")).toBeInTheDocument();

    const firstItem = scroller.children[0] as HTMLElement;
    expect(firstItem.className).toContain("shrink-0");
    expect(firstItem.className).toContain("snap-start");
    expect(firstItem.className).toContain("lg:w-[calc((100%-2*1.75rem)/3)]");
  });

  it("renders a horizontally scrolling, snap-aligned row with a hidden scrollbar", () => {
    const { container } = render(
      createElement(ShopCardRow, null, createElement("span", { key: "a" }, "A"))
    );

    const scroller = getScroller(container);
    expect(scroller.className).toContain("overflow-x-auto");
    expect(scroller.className).toContain("snap-x");
    expect(scroller.className).toContain("[&::-webkit-scrollbar]:hidden");
  });

  it("renders desktop-only prev/next buttons", () => {
    render(createElement(ShopCardRow, null, createElement("span", { key: "a" }, "A")));

    const prev = screen.getByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });
    // hidden by default, shown at lg
    expect(prev.className).toContain("hidden");
    expect(prev.className).toContain("lg:grid");
    expect(next.className).toContain("lg:grid");
  });

  it("skips null children without rendering empty wrappers", () => {
    const { container } = render(
      createElement(ShopCardRow, null, createElement("span", { key: "a" }, "A"), null, false)
    );

    expect(getScroller(container).children).toHaveLength(1);
  });
});
