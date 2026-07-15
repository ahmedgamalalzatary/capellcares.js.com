import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { ProductVariantSelector } from "@/components/products/ProductVariantSelector";
import type { StorefrontProduct } from "@/lib/products";

const product: StorefrontProduct = {
  id: 7,
  slug: "matrix-product",
  name: { ar: "منتج", en: "Matrix product" },
  keywords: [], imagePath: "/product.png", media: [], status: "active", isNew: false, isBestseller: false,
  sizes: [{ id: 1, label: "100ml", sortOrder: 1 }, { id: 2, label: "200ml", sortOrder: 2 }],
  colors: [{ id: 10, hex: "#FFFFFF", sortOrder: 1 }, { id: 11, hex: "#000000", sortOrder: 2 }],
  variants: [
    { id: 101, sizeId: 1, colorId: 10, price: 20, stock: 2 },
    { id: 102, sizeId: 1, colorId: 11, price: 22, stock: 3 },
    { id: 103, sizeId: 2, colorId: 10, price: 25, stock: 0 },
    { id: 104, sizeId: 2, colorId: 11, price: 27, stock: 4 }
  ]
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ProductVariantSelector", () => {
  it("resolves query selections and updates availability, price, and stock", () => {
    render(<LocaleProvider lang="en"><ProductVariantSelector product={product} initialSizeId={1} initialColorId={10} /></LocaleProvider>);

    expect(screen.getByText("20 EGP")).toBeInTheDocument();
    expect(screen.getByText("2 in stock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Color #000000" }));
    fireEvent.click(screen.getByRole("button", { name: "200ml" }));
    expect(screen.getByText("27 EGP")).toBeInTheDocument();
    expect(screen.getByText("4 in stock")).toBeInTheDocument();
  });

  it("adds the resolved sellable variant to the local cart", () => {
    render(<LocaleProvider lang="en"><ProductVariantSelector product={product} initialVariantId={102} /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: "ADD TO CART" }));
    expect(JSON.parse(localStorage.getItem("minikoshk_cart") ?? "[]")).toEqual([{ variantId: 102, qty: 1 }]);
  });
});
