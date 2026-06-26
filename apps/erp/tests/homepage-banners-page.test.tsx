import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedUseAdminAuth = vi.fn(() => ({
  user: {
    name: "Admin User",
    email: "admin@capella.test",
    role: "admin",
    permissionKeys: ["homepage_banners.read", "homepage_banners.update"]
  },
  hydrated: true,
  logout: vi.fn()
}));

const mockedUseStore = vi.fn((selector: any) => selector({
  homepageSections: {
    hero_primary: {
      key: "hero_primary",
      title: "Section 1",
      items: [
        { id: 1, imagePath: "/uploads/hero-1.png", href: "/products/p1" },
        { id: 2, imagePath: "/uploads/hero-2.png", href: "/products/p2" }
      ]
    },
    grid_featured: {
      key: "grid_featured",
      title: "Section 2",
      items: Array.from({ length: 5 }, (_, index) => ({
        id: index + 10,
        imagePath: `/uploads/grid-${index + 1}.png`,
        href: `/offers/${index + 1}`
      }))
    },
    single_mid: {
      key: "single_mid",
      title: "Section 3",
      items: [{ id: 20, imagePath: "/uploads/single-1.png", href: "/collections/1" }]
    },
    hero_secondary: {
      key: "hero_secondary",
      title: "Section 4",
      items: []
    },
    single_footer: {
      key: "single_footer",
      title: "Section 5",
      items: []
    }
  }
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children, actions }: any) => createElement("div", null, actions, children)
}));

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => mockedUseStore(selector),
  getStore: () => ({
    fetchHomepageBanners: vi.fn().mockResolvedValue(undefined)
  })
}));

import HomepageBannersPage from "@/app/homepage-banners/page";

describe("HomepageBannersPage", () => {
  beforeEach(() => {
    mockedUseAdminAuth.mockReset();
    mockedUseStore.mockClear();
    mockedUseAdminAuth.mockReturnValue({
      user: {
        name: "Admin User",
        email: "admin@capella.test",
        role: "admin",
        permissionKeys: ["homepage_banners.read", "homepage_banners.update"]
      },
      hydrated: true,
      logout: vi.fn()
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows all five homepage sections and the section-2 count", () => {
    render(createElement(HomepageBannersPage));

    expect(screen.getByText("بنرات الصفحة الرئيسية")).toBeInTheDocument();
    expect(screen.getByText("Section 1")).toBeInTheDocument();
    expect(screen.getByText("Section 2")).toBeInTheDocument();
    expect(screen.getByText("Section 3")).toBeInTheDocument();
    expect(screen.getByText("Section 4")).toBeInTheDocument();
    expect(screen.getByText("Section 5")).toBeInTheDocument();
    expect(screen.getByText("5 صورة")).toBeInTheDocument();
  });

  it("shows a 403 state for staff without homepage banner permissions", () => {
    mockedUseAdminAuth.mockReturnValue({
      user: {
        name: "Staff User",
        email: "staff@capella.test",
        role: "staff",
        permissionKeys: []
      },
      hydrated: true,
      logout: vi.fn()
    });

    render(createElement(HomepageBannersPage));

    expect(screen.getByText("غير مصرح")).toBeInTheDocument();
    expect(screen.getByText("لا تملكين صلاحية الوصول إلى بنرات الصفحة الرئيسية.")).toBeInTheDocument();
  });
});
