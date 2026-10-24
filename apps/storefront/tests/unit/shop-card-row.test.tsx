import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { ShopCardRow } from "@/components/shop/shop-card-row";
import { CardImageCarousel } from "@/components/ui/card-image-carousel";
import { useCardSliderScreen } from "../helpers/media-query";

function getScroller(container: HTMLElement): HTMLElement {
  // first child of the relative wrapper is the scrolling row
  return container.firstElementChild!.firstElementChild as HTMLElement;
}

describe("ShopCardRow", () => {
  it("skips null children without rendering empty wrappers", () => {
    const { container } = render(
      createElement(ShopCardRow, { lang: "en", children: [createElement("span", { key: "a" }, "A"), null, false] })
    );

    expect(getScroller(container).children).toHaveLength(1);
  });

  it("labels its arrows in the page language", () => {
    render(createElement(ShopCardRow, { lang: "ar", children: createElement("span", { key: "a" }, "A") }));

    expect(screen.getByRole("button", { name: "السابق" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "التالي" })).toBeInTheDocument();
  });

  it("turns the card image swipe off for its cards, so a sideways swipe scrolls the row", () => {
    useCardSliderScreen();
    render(createElement(ShopCardRow, {
      lang: "en",
      children: createElement(CardImageCarousel, {
        images: ["/one.jpg", "/two.jpg"],
        hoverImage: "/hover.jpg",
        href: "/en/products/p",
        label: "Product",
        lang: "en",
        renderImage: (url: string) => createElement("img", { src: url, alt: "Product" })
      })
    }));

    expect(screen.getByRole("link", { name: "Product" }).className).not.toContain("touch-pan-y");
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
});
