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
      { id: 1, slug: "new-product", label: "New Product", name: { en: "New Product", ar: "منتج جديد" }, imagePath: "" }
    ]
  },
  {
    type: "products",
    key: "bestsellers",
    slug: "bestsellers",
    label: "Best Seller",
    products: [
      { id: 2, slug: "best-product", label: "Best Product", name: { en: "Best Product", ar: "أفضل منتج" }, imagePath: "" }
    ]
  },
  {
    type: "category",
    key: "category-10",
    slug: "skin-care",
    label: "Skin Care",
    sortOrder: 2,
    children: [
      { id: 102, slug: "cleansers", label: "Cleansers", imagePath: "/uploads/cleansers.jpg", children: [] },
      { id: 101, slug: "serums", label: "Serums", imagePath: null, children: [] }
    ]
  },
  {
    type: "category",
    key: "category-11",
    slug: "body-care",
    label: "Body Care",
    sortOrder: 1,
    children: []
  },
  {
    type: "offers",
    key: "offers",
    slug: "offers",
    label: "Offers",
    offers: [
      { id: 5, slug: "summer-bundle", label: "Summer Bundle", name: { en: "Summer Bundle", ar: "حزمة" }, imagePath: "" }
    ]
  },
  {
    type: "collections",
    key: "collections",
    slug: "collections",
    label: "Collections",
    collections: [
      { id: 6, slug: "starter-kit", label: "Starter Kit", name: { en: "Starter Kit", ar: "مجموعة" }, imagePath: "" }
    ]
  }
];

const dict = { nav: { viewAllCategory: "All {name} →" } };

describe("ShopMegaMenu", () => {
  it("orders tabs as New, Best Seller, Offers, categories, Collections (last)", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    expect(screen.getAllByRole("button").slice(1, 7).map((item) => item.textContent?.trim())).toEqual([
      "New",
      "Best Seller",
      "Offers",
      "Body Care",
      "Skin Care",
      "Collections"
    ]);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "New" }));
    expect(screen.getByRole("link", { name: "New Product" })).toHaveAttribute("href", "/en/products/new-product");
  });

  it("shows real offers under the Offers tab with an 'All Offers' link", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Offers" }));

    expect(screen.getByRole("link", { name: "All Offers →" })).toHaveAttribute("href", "/en/offers");
    expect(screen.getByRole("link", { name: /Summer Bundle/ })).toHaveAttribute("href", "/en/offers/summer-bundle");
  });

  it("shows real collections under the Collections tab with an 'All Collections' link", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Collections" }));

    expect(screen.getByRole("link", { name: "All Collections →" })).toHaveAttribute("href", "/en/collections");
    expect(screen.getByRole("link", { name: /Starter Kit/ })).toHaveAttribute("href", "/en/collections/starter-kit");
  });

  it("applies an underline + bold hover to leaf (non-parent) sub-category links", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Skin Care" }));

    const subLink = screen.getByRole("link", { name: "Cleansers" });
    expect(subLink.className).toContain("hover:underline");
    expect(subLink.className).toContain("hover:font-bold");
    expect(subLink.className).not.toContain("hover:text-accent");
  });

  it("uses the same underline + bold hover for New/Bestseller product links", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "New" }));

    const productLink = screen.getByRole("link", { name: "New Product" });
    expect(productLink.className).toContain("hover:underline");
    expect(productLink.className).toContain("hover:font-bold");
    expect(productLink.className).not.toContain("hover:text-accent");
  });

  it("closes the panel instantly when any child link is clicked", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    const panel = screen.getByRole("menu");
    expect(panel.className).toContain("pointer-events-auto");

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Skin Care" }));
    fireEvent.click(screen.getByRole("link", { name: "Cleansers" }));

    expect(panel.className).toContain("pointer-events-none");
  });

  it("gives every panel link the same size, spacing and hover regardless of type", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));
    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    const sample = (tab: string, link: RegExp | string) => {
      fireEvent.mouseEnter(screen.getByRole("button", { name: tab }));
      return screen.getByRole("link", { name: link }).className;
    };

    const classes = [
      sample("New", "New Product"),
      sample("Skin Care", "Cleansers"),
      sample("Offers", /Summer Bundle/),
      sample("Collections", /Starter Kit/)
    ];

    for (const className of classes) {
      expect(className).toContain("text-base");
      expect(className).toContain("hover:underline");
      expect(className).toContain("hover:font-bold");
    }
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

  it("sorts category tabs by sortOrder even when menuEntries arrive unsorted", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    expect(screen.getAllByRole("button").slice(1, 7).map((item) => item.textContent?.trim())).toEqual([
      "New",
      "Best Seller",
      "Offers",
      "Body Care",
      "Skin Care",
      "Collections"
    ]);
  });

  it("renders child categories in the provided sibling order", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Skin Care" }));

    expect(screen.getAllByRole("link").map((item) => item.textContent?.trim())).toContain("Cleansers");
    expect(screen.getAllByRole("link").map((item) => item.textContent?.trim())).toContain("Serums");
    expect(
      screen.getAllByRole("link")
        .map((item) => item.textContent?.trim())
        .filter((item) => item === "Cleansers" || item === "Serums")
    ).toEqual(["Cleansers", "Serums"]);
  });

  it("renders category images beside the child category text when available", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Skin Care" }));

    expect(screen.getByAltText("Cleansers")).toHaveAttribute("src", "/uploads/cleansers.jpg");
    expect(screen.getByRole("link", { name: "Cleansers" })).toBeInTheDocument();
    expect(screen.queryByAltText("Serums")).toBeNull();
  });
});
