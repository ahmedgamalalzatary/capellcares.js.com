import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductCard } from "@/components/homepage/ProductCard";
import { dictionaries } from "@minikoshk/shared";
import type { StorefrontProduct } from "@/lib/products";

const product: StorefrontProduct = {
  id: 1,
  slug: "swatches",
  name: { ar: "ألوان", en: "Swatches" },
  keywords: [], imagePath: "/product.png", media: [], status: "active", isNew: false, isBestseller: false,
  sizes: [{ id: 1, label: "S", sortOrder: 1 }, { id: 2, label: "M", sortOrder: 2 }],
  colors: [{ id: 10, hex: "#FFFFFF", sortOrder: 1 }, { id: 11, hex: "#000000", sortOrder: 2 }],
  variants: [
    { id: 101, sizeId: 1, colorId: 10, price: 20, stock: 0 },
    { id: 102, sizeId: 2, colorId: 10, price: 20, stock: 3 }
  ]
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ProductCard", () => {
  it("links each available swatch to a complete in-stock variant selection", () => {
    render(<ProductCard product={product} lang="en" dict={dictionaries.en} />);

    expect(screen.getByRole("link", { name: "Color #FFFFFF" })).toHaveAttribute(
      "href",
      "/en/products/swatches?size=2&color=10&variant=102"
    );
    expect(screen.queryByRole("link", { name: "Color #000000" })).not.toBeInTheDocument();
  });

  it("adds the first in-stock variant to the cart from the hover button", () => {
    render(<ProductCard product={product} lang="en" dict={dictionaries.en} />);

    fireEvent.click(screen.getByRole("button", { name: "ADD TO CART" }));

    expect(JSON.parse(localStorage.getItem("minikoshk_cart") ?? "[]")).toEqual([
      { type: "product", variantId: 102, qty: 1 }
    ]);
    expect(screen.getByRole("button", { name: "Added" })).toBeInTheDocument();
  });

  it("reveals and unclamps quick actions when a child has focus", () => {
    render(<ProductCard product={product} lang="en" dict={dictionaries.en} />);
    const button = screen.getByRole("button", { name: "ADD TO CART" });
    expect(button.parentElement).toHaveClass("group-focus-within:translate-y-0", "group-focus-within:opacity-100");
    expect(button.parentElement?.parentElement).toHaveClass("group-focus-within:overflow-visible");
  });

  it("disables add-to-cart when no variant is in stock", () => {
    const soldOut: StorefrontProduct = {
      ...product,
      variants: product.variants.map((variant) => ({ ...variant, stock: 0 }))
    };
    render(<ProductCard product={soldOut} lang="en" dict={dictionaries.en} />);

    expect(screen.getByRole("button", { name: "ADD TO CART" })).toBeDisabled();
  });

  it("fills the heart for wishlisted products and toggles the wishlist on click", () => {
    render(<ProductCard product={product} lang="en" dict={dictionaries.en} />);
    const heart = screen.getByRole("button", { name: "Add to wishlist" });

    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(heart.querySelector("svg")).toHaveAttribute("fill", "none");

    fireEvent.click(heart);

    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(heart.querySelector("svg")).toHaveAttribute("fill", "currentColor");
    expect(JSON.parse(localStorage.getItem("minikoshk_wishlist") ?? "[]")).toEqual([1]);

    fireEvent.click(heart);

    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(JSON.parse(localStorage.getItem("minikoshk_wishlist") ?? "[]")).toEqual([]);
  });
});
