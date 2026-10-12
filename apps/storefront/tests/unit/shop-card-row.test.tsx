import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopCardRow } from "@/components/shop/shop-card-row";

function getScroller(container: HTMLElement): HTMLElement {
  // first child of the relative wrapper is the scrolling row
  return container.firstElementChild!.firstElementChild as HTMLElement;
}

describe("ShopCardRow", () => {
  it("skips null children without rendering empty wrappers", () => {
    const { container } = render(
      createElement(ShopCardRow, null, createElement("span", { key: "a" }, "A"), null, false)
    );

    expect(getScroller(container).children).toHaveLength(1);
  });
});
