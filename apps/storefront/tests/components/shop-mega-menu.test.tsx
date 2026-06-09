import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopMegaMenu } from "@/components/layout/header/shop-mega-menu";
import type { HeaderMenuEntry } from "@/lib/header-menu";

const menuEntries: HeaderMenuEntry[] = [
  {
    type: "products",
    key: "new",
    slug: "new",
    label: "New",
    products: [
      { id: 1, slug: "new-product", label: "New Product" }
    ]
  },
  {
    type: "products",
    key: "bestsellers",
    slug: "bestsellers",
    label: "Best Seller",
    products: [
      { id: 2, slug: "best-product", label: "Best Product" }
    ]
  },
  {
    type: "category",
    key: "category-10",
    slug: "skin-care",
    label: "Skin Care",
    children: []
  }
];

const dict = { nav: { viewAllCategory: "All {name} →" } };

describe("ShopMegaMenu", () => {
  it("renders New and Best Seller tabs before categories and links to products", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    expect(screen.getAllByRole("button").slice(1, 4).map((item) => item.textContent?.trim())).toEqual([
      "New",
      "Best Seller",
      "Skin Care"
    ]);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "New" }));
    expect(screen.getByRole("link", { name: "New Product" })).toHaveAttribute("href", "/en/products/new-product");
  });

  it("shows an 'All {category}' link to the root category for category tabs", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Skin Care" }));

    expect(screen.getByRole("link", { name: "All Skin Care →" })).toHaveAttribute("href", "/en/category/skin-care");
  });

  it("links product tabs (New / Best Seller) to their dedicated page", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "New" }));

    expect(screen.getByRole("link", { name: "All New →" })).toHaveAttribute("href", "/en/new");
  });
});
