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
    viewAllCategory: "All {name} →",
    products: "Shop",
    new: "New",
    bestsellers: "Bestseller",
    orders: "Orders",
    account: "Account",
    followUs: "Follow us"
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

  it("lists Offers, Sets, then categories by sort order, all closed", () => {
    renderDrawer();
    const sections = screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
    expect(sections.map((button) => button.textContent?.trim())).toEqual(["Offers", "Sets", "Care"]);
    expect(sections.every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(screen.queryByRole("link", { name: "Duo Kit" })).toBeNull();
  });

  it("opens one section at a time", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Offers" }));
    expect(screen.getByRole("link", { name: "All Offers →" })).toHaveAttribute("href", "/en/offers");
    expect(screen.getByRole("link", { name: "Duo Kit" })).toHaveAttribute("href", "/en/offers/duo-kit");
    expect(screen.getByAltText("")).toHaveAttribute("src", "/uploads/duo-kit.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Sets" }));
    expect(screen.queryByRole("link", { name: "Duo Kit" })).toBeNull();
    expect(screen.getByRole("link", { name: "All Sets →" })).toHaveAttribute("href", "/en/collections");
    expect(screen.getByRole("link", { name: "Starter Set" })).toHaveAttribute("href", "/en/collections/starter");
  });

  it("closes an open section when it is tapped again", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Offers" }));
    fireEvent.click(screen.getByRole("button", { name: "Offers" }));
    expect(screen.queryByRole("link", { name: "Duo Kit" })).toBeNull();
  });

  it("shows second-level categories in their given order, without deeper levels", () => {
    renderDrawer({ lang: "ar", isAr: true });
    fireEvent.click(screen.getByRole("button", { name: "Care" }));
    expect(screen.getByRole("link", { name: "All Care →" })).toHaveAttribute("href", "/ar/category/care?categoryId=1");
    const names = screen.getAllByRole("link").map((link) => link.textContent?.trim());
    expect(names.indexOf("Cleansers")).toBeLessThan(names.indexOf("Serums"));
    expect(screen.getByRole("link", { name: "Serums" })).toHaveAttribute("href", "/ar/category/serums?categoryId=2");
    expect(screen.queryByRole("link", { name: "Vitamin C" })).toBeNull();
  });

  it("makes a category with no children a plain link", () => {
    renderDrawer();
    expect(screen.getByRole("link", { name: "Body" })).toHaveAttribute("href", "/en/category/body?categoryId=2");
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
