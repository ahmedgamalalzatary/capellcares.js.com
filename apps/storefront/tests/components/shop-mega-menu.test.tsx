import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopMegaMenu } from "@/components/layout/header/shop-mega-menu";
import type { HeaderMenuEntry } from "@/lib/header-menu";

const menuEntries: HeaderMenuEntry[] = [
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
  it("orders tabs as categories then Collections (last), with no New/Bestseller/Offers", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    expect(screen.getAllByRole("button").slice(1, 4).map((item) => item.textContent?.trim())).toEqual([
      "Body Care",
      "Skin Care",
      "Collections"
    ]);

    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Best Seller" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Offers" })).toBeNull();
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
      sample("Skin Care", "Cleansers"),
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

  it("sorts category tabs by sortOrder even when menuEntries arrive unsorted", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    expect(screen.getAllByRole("button").slice(1, 4).map((item) => item.textContent?.trim())).toEqual([
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
