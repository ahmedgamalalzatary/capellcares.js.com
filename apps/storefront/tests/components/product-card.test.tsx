import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductCard } from "@/components/products/product-card";
import { products } from "@capella/shared/mock";

const push = vi.fn();

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push
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
  badges: { new: "New", bestseller: "Bestseller", offer: "Offer" },
  common: { addToWishlist: "Add to wishlist", outOfStock: "Out of stock" },
  wishlist: {
    loginRequiredDesc: "Please log in first.",
    goLogin: "Log in"
  }
};

describe("ProductCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    push.mockReset();
  });

  it("shows a price range for multi-variant products", () => {
    render(createElement(ProductCard, { product: products[0]!, lang: "en", dict }));
    expect(screen.getByText(/220/i)).toBeInTheDocument();
    expect(screen.getByText(/620/i)).toBeInTheDocument();
  });

  it("redirects guests to wishlist when they try to add a product to wishlist", () => {
    render(createElement(ProductCard, { product: products[0]!, lang: "en", dict }));
    fireEvent.click(screen.getAllByRole("button", { name: /add to wishlist/i })[0]!);

    expect(push).toHaveBeenCalledWith("/en/wishlist");
  });
});
