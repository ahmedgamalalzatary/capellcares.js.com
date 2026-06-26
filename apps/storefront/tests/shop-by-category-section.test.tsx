import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import type { Language } from "@minikoshk/shared";
import { ShopByCategory } from "@/components/homepage/ShopByCategory";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import type { StorefrontCategory } from "@/lib/categories";

function makeCategory(overrides: Partial<StorefrontCategory> & { id: number }): StorefrontCategory {
  return {
    parentId: 1,
    slug: `cat-${overrides.id}`,
    sortOrder: overrides.id,
    name: { ar: `قسم ${overrides.id}`, en: `Category ${overrides.id}` },
    imagePath: `/uploads/cat-${overrides.id}.png`,
    isLeaf: true,
    deletedAt: null,
    ...overrides
  };
}

function renderWithLocale(node: ReactNode, lang: Language = "en") {
  return render(<LocaleProvider lang={lang}>{node}</LocaleProvider>);
}

afterEach(() => {
  cleanup();
});

describe("ShopByCategory", () => {
  it("renders a labelled region with one locale-prefixed linked card per category", () => {
    const categories = [
      makeCategory({ id: 2, slug: "slides", name: { ar: "شباشب", en: "Slides" } }),
      makeCategory({ id: 3, slug: "socks", name: { ar: "جوارب", en: "Socks" } })
    ];

    renderWithLocale(<ShopByCategory categories={categories} />);

    expect(screen.getByRole("region", { name: /shop by category/i })).toBeInTheDocument();

    const slidesLink = screen.getByRole("link", { name: /slides/i });
    expect(slidesLink).toHaveAttribute("href", "/en/shop?category=slides");
    expect(screen.getByRole("img", { name: "Slides" })).toHaveAttribute("src", "/uploads/cat-2.png");
    expect(screen.getByRole("link", { name: /socks/i })).toHaveAttribute("href", "/en/shop?category=socks");
  });

  it("uses the Arabic name and ar-prefixed link when lang is ar", () => {
    renderWithLocale(
      <ShopByCategory categories={[makeCategory({ id: 2, slug: "slides", name: { ar: "شباشب", en: "Slides" } })]} />,
      "ar"
    );

    expect(screen.getByRole("img", { name: "شباشب" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /شباشب/ })).toHaveAttribute("href", "/ar/shop?category=slides");
  });

  it("renders nothing when there are no categories", () => {
    const { container } = renderWithLocale(<ShopByCategory categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
