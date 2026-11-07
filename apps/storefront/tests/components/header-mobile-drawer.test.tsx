import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { HeaderMobileDrawer } from "@/components/layout/header/mobile-drawer";
import type { HeaderMenuEntry } from "@/lib/header-menu";
import { SOCIAL_LINKS } from "@/constants/socials";

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
  // New/Bestsellers still exist in the header menu data; the drawer links to their pages instead of expanding them.
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
    type: "category",
    key: "category-1",
    id: 1,
    slug: "care",
    label: "Care",
    imagePath: "/uploads/care.jpg",
    sortOrder: 2,
    children: [
      { id: 5, slug: "cleansers", label: "Cleansers", imagePath: "/uploads/cleansers.jpg", children: [] },
      { id: 2, slug: "serums", label: "Serums", imagePath: null, children: [{ id: 3, slug: "vitamin-c", label: "Vitamin C", imagePath: null, children: [] }] }
    ]
  },
  {
    type: "category",
    key: "category-2",
    id: 2,
    slug: "body",
    label: "Body",
    sortOrder: 1,
    children: []
  }
];

const brands = [
  { id: 1, slug: "lego", name: { ar: "ليجو", en: "LEGO" }, imagePath: "/uploads/lego.png", hasProducts: true },
  { id: 2, slug: "unused", name: { ar: "غير", en: "Unused" }, imagePath: null, hasProducts: false }
];
const genders = [{ id: 1, slug: "girls", name: { ar: "بنات", en: "Girls" }, imagePath: "/uploads/girls.png", arImagePath: "/uploads/girls-ar.png", hasProducts: false }];

const dict = {
  brand: "Falta Toy",
  footer: { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", whatsapp: "WhatsApp" },
  nav: {
    search: "Search",
    followUs: "Follow us",
    genders: "Gender",
    allGenders: "All Genders",
    brands: "Brands",
    allBrands: "All Brands",
    allCategories: "All Categories",
    categories: "Categories",
    products: "Shop",
    new: "New",
    bestsellers: "Bestseller",
    offers: "Offers",
    orders: "Orders",
    account: "Account",
    wishlist: "Wishlist"
  },
  media: { close: "Close" },
  langSwitch: { ar: "العربية", en: "English" }
};

function renderDrawer(overrides: Record<string, unknown> = {}) {
  const props = {
    lang: "en" as const,
    dict,
    menuEntries,
    brands,
    genders,
    onOpenSearch: vi.fn(),
    isAr: false,
    mobileOpen: true,
    user: null,
    accountHref: "/en/login",
    onClose: vi.fn(),
    onSwitchLang: vi.fn(),
    ...overrides
  };
  render(createElement(HeaderMobileDrawer, props));
  return props;
}

beforeAll(() => {
  // A phone-width screen: at desktop width the drawer closes itself.
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
});

describe("HeaderMobileDrawer", () => {
  it("is a named dialog that closes from its button and with Escape", () => {
    const { onClose } = renderDrawer();
    expect(screen.getByRole("dialog", { name: "Falta Toy" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("has a search bar at the top, beside the logo, that opens search", () => {
    const { onOpenSearch } = renderDrawer();
    const search = screen.getByRole("button", { name: "Search" });
    const logo = screen.getByRole("img", { name: "Falta Toy" });
    const close = screen.getByRole("button", { name: "Close" });
    expect(logo.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(search);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it("orders the menu: shop, gender, categories, brands, new, bestseller, offers, wishlist, account, follow us, then the language switch", () => {
    renderDrawer();
    const nav = screen.getByRole("navigation");
    const rows = Array.from(nav.querySelectorAll("a, button")).map((row) => row.textContent?.trim()).filter(Boolean);
    expect(rows).toEqual(["Shop", "Gender", "Categories", "Brands", "New", "Bestseller", "Offers", "Wishlist", "Account"]);
    expect(screen.getByRole("link", { name: "Wishlist" })).toHaveAttribute("href", "/en/wishlist");
    expect(screen.getByRole("link", { name: "Account" }).compareDocumentPosition(screen.getByText("Follow us")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav.compareDocumentPosition(screen.getByRole("button", { name: "English" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has no sets row, and links offers to its page", () => {
    renderDrawer();
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/en/offers");
    expect(screen.queryByText("Sets")).toBeNull();
  });

  it("shows the follow us section in the main menu, with every account", () => {
    renderDrawer();
    expect(within(screen.getByRole("navigation")).getByText("Follow us")).toBeInTheDocument();
    for (const name of ["Facebook", "Instagram", "TikTok", "YouTube", "WhatsApp"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("target", "_blank");
    }
  });

  it("opens brands like categories: all brands first, then each brand with its picture, leaving out brands with no toys", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Brands" }));
    expect(screen.getByRole("link", { name: "All Brands" })).toHaveAttribute("href", "/en/shop#brands");
    const lego = screen.getByRole("link", { name: "LEGO" });
    expect(lego).toHaveAttribute("href", "/en/brands/lego");
    expect(lego.querySelector("img")?.getAttribute("src")).toContain("lego.png");
    expect(screen.queryByRole("link", { name: "Unused" })).toBeNull();
  });

  it("shows each category with its picture, under an all categories link", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    expect(screen.getByRole("link", { name: "All Categories" })).toHaveAttribute("href", "/en/shop#categories");
    expect(screen.getByRole("link", { name: "Care" }).querySelector("img")?.getAttribute("src")).toContain("care.jpg");
  });

  it("opens every gender above the categories", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Gender" }));
    expect(screen.getByRole("link", { name: "Girls" })).toHaveAttribute("href", "/en/genders/girls");
  });

  it("shows each gender with its picture in the page language, under an all genders link", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Gender" }));
    expect(screen.getByRole("link", { name: "All Genders" })).toHaveAttribute("href", "/en/shop#genders");
    expect(screen.getByRole("link", { name: "Girls" }).querySelector("img")?.getAttribute("src")).toContain("girls.png");
    cleanup();

    renderDrawer({ lang: "ar", isAr: true });
    fireEvent.click(screen.getByRole("button", { name: "Gender" }));
    expect(screen.getByRole("link", { name: "بنات" }).querySelector("img")?.getAttribute("src")).toContain("girls-ar.png");
  });

  it("lists YouTube where the footer has Instagram, and Instagram where it has YouTube", () => {
    renderDrawer();
    const names = within(screen.getByRole("navigation")).getAllByRole("link", { name: /^(Facebook|Instagram|TikTok|YouTube|WhatsApp)$/ })
      .map((link) => link.getAttribute("aria-label"));
    const footerOrder = SOCIAL_LINKS.map((link) => link.label as string);
    const swapped = footerOrder.map((name) => name === "Instagram" ? "YouTube" : name === "YouTube" ? "Instagram" : name);
    expect(names).toEqual(swapped);
  });

  it("opens the categories dropdown with main categories in order, each going to its page", () => {
    renderDrawer({ lang: "ar", isAr: true });
    const toggle = screen.getByRole("button", { name: "Categories" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Body" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Body" })).toHaveAttribute("href", "/ar/category/body?categoryId=2");
    expect(screen.getByRole("link", { name: "Care" })).toHaveAttribute("href", "/ar/category/care?categoryId=1");
    const names = screen.getAllByRole("link").map((link) => link.textContent?.trim());
    expect(names.indexOf("Body")).toBeLessThan(names.indexOf("Care"));
    expect(screen.queryByRole("link", { name: "Cleansers" })).toBeNull();

    fireEvent.click(toggle);
    expect(screen.queryByRole("link", { name: "Body" })).toBeNull();
  });

  it("links the main pages, and the account or orders page", () => {
    renderDrawer();
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/en/shop");
    expect(screen.getByRole("link", { name: "New" })).toHaveAttribute("href", "/en/new");
    expect(screen.getByRole("link", { name: "Bestseller" })).toHaveAttribute("href", "/en/bestsellers");
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/en/login");
  });

  it("shows Orders instead of Account once signed in", () => {
    renderDrawer({ user: { id: 1, name: "A", email: "a@b.c" }, accountHref: "/en/orders" });
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/en/orders");
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
  });

  it("closes after a link is followed", () => {
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole("link", { name: "Shop" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches language only from the other language's button", () => {
    const { onSwitchLang } = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(onSwitchLang).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "العربية" }));
    expect(onSwitchLang).toHaveBeenCalledTimes(1);
  });
});
