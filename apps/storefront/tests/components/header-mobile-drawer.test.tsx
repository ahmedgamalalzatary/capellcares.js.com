import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { HeaderMobileDrawer } from "@/components/layout/header/mobile-drawer";
import type { HeaderMenuEntry } from "@/lib/header-menu";

const menuEntries: HeaderMenuEntry[] = [
  {
    type: "offers",
    key: "offers",
    slug: "offers",
    label: "Offers",
    offers: [
      { id: 200, slug: "duo-kit", label: "Duo Kit", name: { en: "Duo Kit", ar: "طقم" }, imagePath: "/uploads/duo-kit.jpg" }
    ]
  },
  {
    type: "collections",
    key: "collections",
    slug: "collections",
    label: "Sets",
    collections: [
      { id: 300, slug: "starter", label: "Starter Set", name: { en: "Starter Set", ar: "مجموعة" }, imagePath: "" }
    ]
  },
  // New/Bestsellers still exist in the header menu data; the drawer must not surface them.
  {
    type: "products",
    key: "new",
    slug: "new",
    label: "New",
    products: [
      { id: 100, slug: "fresh-serum", label: "Fresh Serum", name: { en: "Fresh Serum", ar: "سيروم" }, imagePath: "" }
    ]
  },
  {
    type: "products",
    key: "bestsellers",
    slug: "bestsellers",
    label: "Bestsellers",
    products: [
      { id: 101, slug: "hero-cream", label: "Hero Cream", name: { en: "Hero Cream", ar: "كريم" }, imagePath: "" }
    ]
  },
  {
    type: "category",
    key: "category-1",
    id: 1,
    slug: "care",
    label: "العناية",
    sortOrder: 2,
    children: [
      { id: 5, slug: "cleansers", label: "منظفات", imagePath: "/uploads/cleansers.jpg", children: [] },
      { id: 2, slug: "serums", label: "سيروم", imagePath: null, children: [{ id: 3, slug: "vitamin-c", label: "فيتامين سي", imagePath: null, children: [] }] }
    ]
  },
  {
    type: "category",
    key: "category-2",
    id: 2,
    slug: "body",
    label: "الجسم",
    sortOrder: 1,
    children: [
      { id: 4, slug: "lotions", label: "لوشن", imagePath: null, children: [] }
    ]
  }
];

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn()
  });
});

describe("HeaderMobileDrawer", () => {
  it("shows Offers and Sets tabs before categories, and no New/Bestsellers tab", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "en",
      dict: {
        nav: {
          search: "Search",
          viewAll: "View all",
          viewAllCategory: "All {name} →",
          products: "Products",
          offers: "Offers",
          orders: "Orders",
          followUs: "Follow us"
        },
        langSwitch: { ar: "Arabic", en: "English" }
      },
      menuEntries,
      isAr: false,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    expect(screen.getAllByRole("button").slice(1, 5).map((item) => item.textContent?.trim())).toEqual([
      "Offers",
      "Sets",
      "الجسم",
      "العناية"
    ]);
    expect(screen.queryByRole("button", { name: "New" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bestsellers" })).toBeNull();
  });

  it("lists each offer under the Offers tab behind an 'All Offers' card", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "en",
      dict: {
        nav: {
          search: "Search",
          viewAll: "View all",
          viewAllCategory: "All {name} →",
          products: "Products",
          offers: "Offers",
          orders: "Orders",
          followUs: "Follow us"
        },
        langSwitch: { ar: "Arabic", en: "English" }
      },
      menuEntries,
      isAr: false,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    expect(screen.getByRole("link", { name: "All Offers →" })).toHaveAttribute("href", "/en/offers");
    expect(screen.getByRole("link", { name: "Duo Kit" })).toHaveAttribute("href", "/en/offers/duo-kit");
    expect(screen.getByAltText("Duo Kit")).toHaveAttribute("src", "/uploads/duo-kit.jpg");
  });

  it("lists each set under the Sets tab behind an 'All Sets' card", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "ar",
      dict: {
        nav: {
          search: "بحث",
          viewAll: "عرض الكل",
          viewAllCategory: "كل {name} ←",
          products: "المنتجات",
          offers: "العروض",
          orders: "الطلبات",
          followUs: "تابعنا"
        },
        langSwitch: { ar: "العربية", en: "English" }
      },
      menuEntries,
      isAr: true,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    fireEvent.click(screen.getByRole("button", { name: "Sets" }));

    expect(screen.getByRole("link", { name: "كل Sets ←" })).toHaveAttribute("href", "/ar/collections");
    expect(screen.getByRole("link", { name: "Starter Set" })).toHaveAttribute("href", "/ar/collections/starter");
    // No image path on this set, so no <img> is rendered at all.
    expect(screen.queryByAltText("Starter Set")).toBeNull();
  });

  it("offers New and Bestseller as quick links, since Offers and Sets are now tabs", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "en",
      dict: {
        nav: {
          search: "Search",
          viewAll: "View all",
          viewAllCategory: "All {name} →",
          products: "Products",
          offers: "Offers",
          collections: "Collections",
          new: "New",
          bestsellers: "Bestseller",
          orders: "Orders",
          followUs: "Follow us"
        },
        langSwitch: { ar: "Arabic", en: "English" }
      },
      menuEntries,
      isAr: false,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("href", "/en/shop");
    expect(screen.getByRole("link", { name: "New" })).toHaveAttribute("href", "/en/new");
    expect(screen.getByRole("link", { name: "Bestseller" })).toHaveAttribute("href", "/en/bestsellers");
    // Offers/Sets live in the tab strip now, so they are not repeated down here.
    expect(screen.queryByRole("link", { name: "Collections" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Offers" })).toBeNull();
  });

  it("uses the provided lang for nested category links", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "ar",
      dict: {
        nav: {
          search: "بحث",
          viewAll: "عرض الكل",
          viewAllCategory: "كل {name} ←",
          products: "المنتجات",
          offers: "العروض",
          orders: "الطلبات",
          followUs: "تابعنا"
        },
        langSwitch: { ar: "العربية", en: "English" }
      },
      menuEntries,
      isAr: true,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    fireEvent.click(screen.getByRole("button", { name: "العناية" }));
    expect(screen.getByRole("link", { name: "سيروم" })).toHaveAttribute("href", "/ar/category/serums?categoryId=2");
    // The drawer renders only the second-level category cards; deeper grandchild
    // levels are no longer surfaced as their own links.
    expect(screen.queryByRole("link", { name: "فيتامين سي" })).toBeNull();
  });

  it("prepends an 'All {category}' card linking to the root category", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "ar",
      dict: {
        nav: {
          search: "بحث",
          viewAll: "عرض الكل",
          viewAllCategory: "كل {name} ←",
          products: "المنتجات",
          offers: "العروض",
          orders: "الطلبات",
          followUs: "تابعنا"
        },
        langSwitch: { ar: "العربية", en: "English" }
      },
      menuEntries,
      isAr: true,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    fireEvent.click(screen.getByRole("button", { name: "العناية" }));
    expect(screen.getByRole("link", { name: "كل العناية ←" })).toHaveAttribute("href", "/ar/category/care?categoryId=1");
  });

  it("omits categoryId from slug-only root category links when the group id is missing", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "en",
      dict: {
        nav: {
          search: "Search",
          viewAll: "View all",
          viewAllCategory: "All {name} →",
          products: "Products",
          offers: "Offers",
          orders: "Orders",
          followUs: "Follow us"
        },
        langSwitch: { ar: "Arabic", en: "English" }
      },
      menuEntries: [
        {
          type: "category",
          key: "category-missing-id",
          slug: "care",
          label: "Care",
          sortOrder: 1,
          children: []
        } as HeaderMenuEntry
      ],
      isAr: false,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    expect(screen.getByRole("link", { name: "Care" })).toHaveAttribute("href", "/en/category/care");
  });

  it("sorts category tabs by sortOrder even when menuEntries arrive unsorted", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "ar",
      dict: {
        nav: {
          search: "بحث",
          viewAll: "عرض الكل",
          viewAllCategory: "كل {name} ←",
          products: "المنتجات",
          offers: "العروض",
          orders: "الطلبات",
          followUs: "تابعنا"
        },
        langSwitch: { ar: "العربية", en: "English" }
      },
      menuEntries,
      isAr: true,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    expect(screen.getAllByRole("button").slice(1, 5).map((item) => item.textContent?.trim())).toEqual([
      "Offers",
      "Sets",
      "الجسم",
      "العناية"
    ]);
  });

  it("renders child category cards in the provided sibling order", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "ar",
      dict: {
        nav: {
          search: "بحث",
          viewAll: "عرض الكل",
          viewAllCategory: "كل {name} ←",
          products: "المنتجات",
          offers: "العروض",
          orders: "الطلبات",
          followUs: "تابعنا"
        },
        langSwitch: { ar: "العربية", en: "English" }
      },
      menuEntries,
      isAr: true,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    fireEvent.click(screen.getByRole("button", { name: "العناية" }));
    expect(
      screen.getAllByRole("link")
        .map((item) => item.textContent?.trim())
        .filter((item) => item === "منظفات" || item === "سيروم")
    ).toEqual(["منظفات", "سيروم"]);
  });

  it("renders category images beside child category names when available", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "ar",
      dict: {
        nav: {
          search: "بحث",
          viewAll: "عرض الكل",
          viewAllCategory: "كل {name} ←",
          products: "المنتجات",
          offers: "العروض",
          orders: "الطلبات",
          followUs: "تابعنا"
        },
        langSwitch: { ar: "العربية", en: "English" }
      },
      menuEntries,
      isAr: true,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    fireEvent.click(screen.getByRole("button", { name: "العناية" }));
    expect(screen.getByAltText("منظفات")).toHaveAttribute("src", "/uploads/cleansers.jpg");
    expect(screen.queryByAltText("سيروم")).toBeNull();
  });
});
