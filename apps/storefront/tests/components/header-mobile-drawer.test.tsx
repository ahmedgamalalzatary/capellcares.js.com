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

const dict = {
  brand: "Falta Toy",
  nav: {
    categories: "Categories",
    products: "Shop",
    new: "New",
    bestsellers: "Bestseller",
    offers: "Offers",
    orders: "Orders",
    account: "Account"
  },
  media: { close: "Close" },
  langSwitch: { ar: "العربية", en: "English" }
};

function renderDrawer(overrides: Record<string, unknown> = {}) {
  const props = {
    lang: "en" as const,
    dict,
    menuEntries,
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

  it("has no search box, because search now sits in the header", () => {
    renderDrawer();
    expect(screen.queryByRole("button", { name: /search/i })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("orders the menu: shop, categories, new, bestseller, account, then the language switch", () => {
    renderDrawer();
    const nav = screen.getByRole("navigation");
    const rows = Array.from(nav.querySelectorAll("a, button")).map((row) => row.textContent?.trim());
    expect(rows).toEqual(["Shop", "Categories", "New", "Bestseller", "Offers", "Account"]);
    expect(nav.compareDocumentPosition(screen.getByRole("button", { name: "English" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has no sets or follow-us rows, and links offers to its page", () => {
    renderDrawer();
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("href", "/en/offers");
    expect(screen.queryByText("Sets")).toBeNull();
    expect(screen.queryByText("Follow us")).toBeNull();
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
