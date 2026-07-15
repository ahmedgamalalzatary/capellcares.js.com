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
    sizes: [{ id: 1, label: "100ml", sortOrder: 1 }],
    colors: [],
    variants: [{ id: 1, sizeId: 1, colorId: null, price: 199, stock: 3 }],
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

  it("renders real product hex colors instead of media thumbnails", () => {
    render(
      <LocaleProvider lang="en">
        <NewArrivals products={[makeProduct({
          id: 2,
          colors: [
            { id: 10, hex: "#FFFFFF", sortOrder: 1 },
            { id: 11, hex: "#000000", sortOrder: 2 }
          ]
        })]} variant="grid" />
      </LocaleProvider>
    );

    expect(screen.getByLabelText("Color #FFFFFF")).toHaveStyle({ backgroundColor: "#FFFFFF" });
    expect(screen.getByLabelText("Color #000000")).toHaveStyle({ backgroundColor: "#000000" });
  });

  it("links add to cart with the selected in-stock combination variant id", () => {
    render(
      <LocaleProvider lang="en">
        <NewArrivals products={[makeProduct({
          id: 3,
          colors: [
            { id: 10, hex: "#FFFFFF", sortOrder: 1 },
            { id: 11, hex: "#000000", sortOrder: 2 }
          ],
          variants: [
            { id: 30, sizeId: 1, colorId: 10, price: 199, stock: 0 },
            { id: 31, sizeId: 1, colorId: 11, price: 219, stock: 3 }
          ]
        })]} variant="grid" />
      </LocaleProvider>
    );

    expect(screen.getByRole("link", { name: "ADD TO CART" })).toHaveAttribute("href", expect.stringContaining("variant=31"));
  });
});
