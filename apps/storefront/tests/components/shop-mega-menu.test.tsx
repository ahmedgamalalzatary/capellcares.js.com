import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShopMegaMenu } from "@/components/layout/header/shop-mega-menu";
import type { HeaderMenuEntry } from "@/lib/header-menu";

const menuEntries: HeaderMenuEntry[] = [
  {
    type: "category",
    key: "category-10",
    id: 10,
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
    id: 11,
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
      { id: 6, slug: "starter-kit", label: "Starter Kit", name: { en: "Starter Kit", ar: "مجموعة" }, imagePath: "/uploads/starter-kit.jpg" }
    ]
  },
  {
    type: "offers",
    key: "offers",
    slug: "offers",
    label: "Offers",
    offers: [
      { id: 9, slug: "duo-deal", label: "Duo Deal", name: { en: "Duo Deal", ar: "عرض" }, imagePath: "/uploads/duo-deal.jpg" },
      { id: 10, slug: "bare-deal", label: "Bare Deal", name: { en: "Bare Deal", ar: "عرض" }, imagePath: "" }
    ]
  }
];

const dict = { nav: { viewAllCategory: "All {name} →" } };

describe("ShopMegaMenu", () => {
  it("leads with Offers and Collections, then the categories, and still hides New/Bestseller", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    expect(screen.getAllByRole("button").slice(1, 5).map((item) => item.textContent?.trim())).toEqual([
      "Offers",
      "Collections",
      "Body Care",
      "Skin Care"
    ]);

    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Best Seller" })).toBeNull();
  });

  it("shows real offers under the Offers tab with an 'All Offers' link", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Offers" }));

    expect(screen.getByRole("link", { name: "All Offers →" })).toHaveAttribute("href", "/en/offers");
    expect(screen.getByRole("link", { name: /Duo Deal/ })).toHaveAttribute("href", "/en/offers/duo-deal");
  });

  it("shows real collections under the Collections tab with an 'All Collections' link", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Collections" }));

    expect(screen.getByRole("link", { name: "All Collections →" })).toHaveAttribute("href", "/en/collections");
    expect(screen.getByRole("link", { name: /Starter Kit/ })).toHaveAttribute("href", "/en/collections/starter-kit");
  });

  it("renders offer and collection thumbnails beside their labels, like category children", () => {
    render(createElement(ShopMegaMenu, { lang: "en", dict, menuEntries, isAr: false }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Offers" }));

    // Same thumbnail treatment NavBranch gives a child category.
    const offerImage = screen.getByAltText("Duo Deal");
    expect(offerImage).toHaveAttribute("src", "/uploads/duo-deal.jpg");
    expect(offerImage.className).toContain("h-12");
    expect(offerImage.className).toContain("w-12");
    expect(offerImage.className).toContain("object-cover");
    expect(screen.getByRole("link", { name: "Duo Deal" })).toContainElement(offerImage);

    // An entry with no artwork still renders, just without a thumbnail.
    expect(screen.getByRole("link", { name: "Bare Deal" })).toBeInTheDocument();
    expect(screen.queryByAltText("Bare Deal")).toBeNull();

    // The "All …" link stays plain text, exactly like "All {category}".
    expect(screen.getByRole("link", { name: "All Offers →" }).querySelector("img")).toBeNull();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Collections" }));
    expect(screen.getByAltText("Starter Kit")).toHaveAttribute("src", "/uploads/starter-kit.jpg");
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

  it("gives every panel link consistent hover treatment regardless of type", () => {
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

    expect(screen.getByRole("link", { name: "All Skin Care →" })).toHaveAttribute("href", "/en/category/skin-care?categoryId=10");
  });

  it("omits categoryId from the root category link when the active category id is missing", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries: [
        {
          type: "category",
          key: "category-no-id",
          slug: "skin-care",
          label: "Skin Care",
          sortOrder: 1,
          children: []
        } as HeaderMenuEntry
      ],
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    expect(screen.getByRole("link", { name: "All Skin Care →" })).toHaveAttribute("href", "/en/category/skin-care");
  });

  it("adds categoryId to child category links so duplicate slugs stay on the right branch", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Skin Care" }));

    expect(screen.getByRole("link", { name: "Cleansers" })).toHaveAttribute("href", "/en/category/cleansers?categoryId=102");
    expect(screen.getByRole("link", { name: "Serums" })).toHaveAttribute("href", "/en/category/serums?categoryId=101");
  });

  it("sorts category tabs by sortOrder even when menuEntries arrive unsorted", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));

    // Offers/Collections lead, so the category order is read from index 3 on.
    expect(screen.getAllByRole("button").slice(3, 5).map((item) => item.textContent?.trim())).toEqual([
      "Body Care",
      "Skin Care"
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

  it("renders child categories as text only, even when they carry an image", () => {
    render(createElement(ShopMegaMenu, {
      lang: "en",
      dict,
      menuEntries,
      isAr: false
    }));

    fireEvent.click(screen.getByRole("button", { name: /shop/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Skin Care" }));

    // "Cleansers" has an imagePath in the fixture; the menu deliberately shows
    // the label alone, so no thumbnail should be rendered for it.
    expect(screen.getByRole("link", { name: "Cleansers" })).toBeInTheDocument();
    expect(screen.queryByAltText("Cleansers")).toBeNull();
    expect(screen.queryByAltText("Serums")).toBeNull();
  });
});
