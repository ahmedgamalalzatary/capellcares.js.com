import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { HeaderMobileDrawer } from "@/components/layout/header/mobile-drawer";
import type { HeaderMenuEntry } from "@/lib/header-menu";

const menuEntries: HeaderMenuEntry[] = [
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
    slug: "care",
    label: "العناية",
    sortOrder: 2,
    children: [
      { id: 5, slug: "cleansers", label: "منظفات", children: [] },
      { id: 2, slug: "serums", label: "سيروم", children: [{ id: 3, slug: "vitamin-c", label: "فيتامين سي", children: [] }] }
    ]
  },
  {
    type: "category",
    key: "category-2",
    slug: "body",
    label: "الجسم",
    sortOrder: 1,
    children: [
      { id: 4, slug: "lotions", label: "لوشن", children: [] }
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
  it("shows New and Bestsellers tabs before categories", () => {
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
      "New",
      "Bestsellers",
      "الجسم",
      "العناية"
    ]);
    expect(screen.getByRole("link", { name: "Fresh Serum" })).toHaveAttribute("href", "/en/products/fresh-serum");
    // Product tabs lead with an "All" card pointing at the dedicated /new page
    expect(screen.getByRole("link", { name: "All New →" })).toHaveAttribute("href", "/en/new");
  });

  it("shows a Collections quick link beside Products and Offers", () => {
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

    expect(screen.getByRole("link", { name: "Collections" })).toHaveAttribute("href", "/en/collections");
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
    expect(screen.getByRole("link", { name: "سيروم" })).toHaveAttribute("href", "/ar/category/serums");
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
    expect(screen.getByRole("link", { name: "كل العناية ←" })).toHaveAttribute("href", "/ar/category/care");
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
      "New",
      "Bestsellers",
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
});
