import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderMobileDrawer } from "@/components/layout/header/mobile-drawer";
import type { NavGroup } from "@/lib/nav";

const navGroups: NavGroup[] = [
  {
    root: { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, isLeaf: false },
    children: [
      {
        id: 2,
        slug: "serums",
        label: "سيروم",
        children: [
          { id: 3, slug: "vitamin-c", label: "فيتامين سي", children: [] }
        ]
      }
    ]
  }
];

describe("HeaderMobileDrawer", () => {
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
      navGroups,
      isAr: true,
      mobileOpen: true,
      user: null,
      onClose: vi.fn(),
      onSwitchLang: vi.fn(),
      onOpenSearch: vi.fn()
    }));

    expect(screen.getByRole("link", { name: "سيروم" })).toHaveAttribute("href", "/ar/category/serums");
    expect(screen.getByRole("link", { name: "فيتامين سي" })).toHaveAttribute("href", "/ar/category/vitamin-c");
  });
});
