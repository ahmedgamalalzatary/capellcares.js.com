import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { NewArrivals } from "@/components/homepage/NewArrivals";
import type { StorefrontProduct } from "@/lib/products";

function makeProduct(overrides: Partial<StorefrontProduct> & { id: number }): StorefrontProduct {
  return {
    slug: "slide-1",
    name: { ar: "منتج", en: "Product" },
    keywords: ["Natural Leather"],
    imagePath: "/uploads/product.png",
    hoverImagePath: "/uploads/product-alt.png",
    media: [],
    status: "active",
    isNew: true,
    isBestseller: false,
    variants: [{ price: 199, stock: 3 }],
    ...overrides
  };
}

describe("NewArrivals", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses the menu translation key for its region label", () => {
    render(
      <LocaleProvider lang="en">
        <NewArrivals products={[makeProduct({ id: 1, keywords: undefined as never })]} variant="grid" />
      </LocaleProvider>
    );

    expect(screen.getByRole("region", { name: "NEW ARRIVALS" })).toBeInTheDocument();
  });
});
