import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: () => headersMock()
}));

describe("storefront root layout", () => {
  afterEach(() => {
    vi.resetModules();
    headersMock.mockReset();
  });

  it("renders English document attributes when middleware provides the locale header", async () => {
    headersMock.mockResolvedValue(new Headers([["x-capella-locale", "en"]]));

    const { default: RootLayout } = await import("@/app/layout");
    const markup = renderToStaticMarkup(await RootLayout({ children: createElement("div", null, "hello") }));

    expect(markup).toContain('<html lang="en" dir="ltr"');
  });

  it("falls back to Arabic document attributes by default", async () => {
    headersMock.mockResolvedValue(new Headers());

    const { default: RootLayout } = await import("@/app/layout");
    const markup = renderToStaticMarkup(await RootLayout({ children: createElement("div", null, "hello") }));

    expect(markup).toContain('<html lang="ar" dir="rtl"');
  });

  it("keeps locale attributes on the shell wrapper for locale-scoped storefront styles", async () => {
    vi.doMock("@/lib/storefront-page-context", () => ({
      resolveStorefrontLang: vi.fn().mockResolvedValue("ar")
    }));
    vi.doMock("@/lib/api/client", () => ({
      fetchCategories: vi.fn().mockResolvedValue([]),
      fetchProducts: vi.fn().mockResolvedValue([]),
      fetchOffers: vi.fn().mockResolvedValue([]),
      fetchCollections: vi.fn().mockResolvedValue([])
    }));
    vi.doMock("@/lib/nav", () => ({
      buildNav: vi.fn().mockReturnValue([])
    }));
    vi.doMock("@/lib/header-menu", () => ({
      buildHeaderMenu: vi.fn().mockReturnValue([])
    }));
    vi.doMock("@/components/providers/cart-provider", () => ({
      CartProvider: ({ children }: { children: React.ReactNode }) => createElement("div", null, children)
    }));
    vi.doMock("@/components/providers/wishlist-provider", () => ({
      WishlistProvider: ({ children }: { children: React.ReactNode }) => createElement("div", null, children)
    }));
    vi.doMock("@/components/providers/auth-provider", () => ({
      AuthProvider: ({ children }: { children: React.ReactNode }) => createElement("div", null, children)
    }));
    vi.doMock("@/components/providers/review-prompt-provider", () => ({
      ReviewPromptProvider: ({ children }: { children: React.ReactNode }) => createElement("div", { "data-review-prompt-provider": true }, children)
    }));
    vi.doMock("@/components/layout/header", () => ({
      Header: () => createElement("header", null, "header")
    }));
    vi.doMock("@/components/layout/footer", () => ({
      Footer: () => createElement("footer", null, "footer")
    }));
    vi.doMock("@/components/ask-capella/ask-capella-button", () => ({
      AskCapellaButton: () => createElement("button", null, "ask")
    }));

    const { default: LocaleLayout } = await import("@/app/[lang]/layout");
    const markup = renderToStaticMarkup(await LocaleLayout({
      children: createElement("div", null, "hello"),
      params: Promise.resolve({ lang: "ar" })
    }));

    expect(markup).toContain('<div class="shell" lang="ar" dir="rtl"');
    expect(markup).toContain('data-review-prompt-provider="true"');
  });
});
