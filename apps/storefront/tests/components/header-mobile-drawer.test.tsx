import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderMobileDrawer } from "@/components/layout/header/mobile-drawer";
import type { HeaderMenuEntry } from "@/lib/header-menu";

const menuEntries: HeaderMenuEntry[] = [
  {
    type: "products",
    key: "new",
    slug: "new",
    label: "New",
    products: [
      { id: 100, slug: "fresh-serum", label: "Fresh Serum" }
    ]
  },
  {
    type: "products",
    key: "bestsellers",
    slug: "bestsellers",
    label: "Bestsellers",
    products: [
      { id: 101, slug: "hero-cream", label: "Hero Cream" }
    ]
  },
  {
    type: "category",
    key: "category-1",
    slug: "care",
    label: "العناية",
    children: [
      {
        id: 2,
        slug: "serums",
        label: "سيروم",
        children: [{ id: 3, slug: "vitamin-c", label: "فيتامين سي", children: [] }]
      }
    ]
  }
];

describe("HeaderMobileDrawer", () => {
  it("shows New and Bestsellers tabs before categories", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "en",
      dict: {
        nav: {
          search: "Search",
          viewAll: "View all",
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

    expect(screen.getAllByRole("button").slice(1, 4).map((item) => item.textContent?.trim())).toEqual([
      "New",
      "Bestsellers",
      "العناية"
    ]);
    expect(screen.getByRole("link", { name: "Fresh Serum" })).toHaveAttribute("href", "/en/products/fresh-serum");
  });

  it("uses the provided lang for nested category links", () => {
    render(createElement(HeaderMobileDrawer, {
      lang: "ar",
      dict: {
        nav: {
          search: "بحث",
          viewAll: "عرض الكل",
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
});
