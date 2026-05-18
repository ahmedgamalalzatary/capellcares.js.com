import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductDetail } from "@/components/products/product-detail";
import { products } from "@capella/shared/mock";

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({
    add: vi.fn()
  })
}));

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({
    has: () => false,
    toggle: vi.fn()
  })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: null
  })
}));

const dict = {
  badges: { new: "New", bestseller: "Bestseller" },
  common: {
    outOfStock: "Out of stock",
    lowStock: "{n} left",
    inStock: "In stock",
    quantity: "Quantity",
    addToCart: "Add to cart",
    buyNow: "Buy now",
    addToWishlist: "Add to wishlist"
  },
  product: {
    sku: "SKU",
    description: "Description",
    ingredients: "Ingredients",
    howToUse: "How to use",
    warnings: "Warnings",
    selectSize: "Select size",
    relatedOffers: "Related offers"
  },
  wishlist: {
    loginRequiredDesc: "Please log in first.",
    goLogin: "Log in"
  },
  offers: {
    save: "Save {amount}"
  }
};

describe("ProductDetail", () => {
  it("renders out-of-stock variants as disabled and blocks add-to-cart when the product is fully out of stock", () => {
    render(createElement(ProductDetail, { product: products[10]!, offers: [], lang: "en", dict }));

    const addToCart = screen.getByRole("button", { name: /add to cart/i });
    expect(addToCart).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /ml/i }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});
