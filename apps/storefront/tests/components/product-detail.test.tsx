import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ add: vi.fn() })
}));

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has: () => false, toggle: vi.fn() })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

import { ProductDetail } from "@/components/products/product-detail";

describe("ProductDetail", () => {
  it("renders image and video media, and falls back to legacy imagePath media", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        relatedOffers: "Related offers"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const baseProduct = {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "Description" },
      ingredients: { ar: "", en: "Ingredients" },
      howToUse: { ar: "", en: "Use" },
      warnings: { ar: "", en: "Warnings" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/legacy.jpg",
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    const { rerender } = render(createElement(ProductDetail, {
      product: {
        ...baseProduct,
        media: [
          { type: "image", url: "/uploads/primary.jpg" },
          { type: "image", url: "/uploads/hover.jpg" },
          { type: "video", url: "/uploads/demo.mp4" }
        ]
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/primary.jpg");
    expect(screen.getByRole("button", { name: "view 3" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "view 3" }));
    expect(document.querySelector("video[controls]")).toHaveAttribute("src", "/uploads/demo.mp4");

    rerender(createElement(ProductDetail, {
      product: {
        ...baseProduct,
        media: [{ type: "image", url: "/uploads/legacy.jpg" }]
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/legacy.jpg");
  });
});
