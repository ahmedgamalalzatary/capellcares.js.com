import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has: () => false, toggle: vi.fn() })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

import { ProductCard } from "@/components/products/product-card";

describe("ProductCard", () => {
  it("switches to the dedicated hover image on hover when one exists", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict: { badges: { new: "New", bestseller: "Bestseller", offer: "Offer" }, common: { outOfStock: "Out", addToWishlist: "Wishlist" } },
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "" },
        ingredients: { ar: "", en: "" },
        howToUse: { ar: "", en: "" },
        warnings: { ar: "", en: "" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/primary.jpg",
        hoverImagePath: "/uploads/hover.jpg",
        media: [
          { type: "image", url: "/uploads/primary.jpg" },
          { type: "image", url: "/uploads/gallery-secondary.jpg" }
        ],
        status: "active",
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      }
    }));

    const card = screen.getByRole("link");
    const image = screen.getByRole("img", { name: "Product" });

    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
    fireEvent.mouseEnter(card);
    expect(image).toHaveAttribute("src", "/uploads/hover.jpg");
    fireEvent.mouseLeave(card);
    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
  });

  it("does not fall back to the second gallery image when no dedicated hover image exists", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict: { badges: { new: "New", bestseller: "Bestseller", offer: "Offer" }, common: { outOfStock: "Out", addToWishlist: "Wishlist" } },
      product: {
        id: 1,
        sku: "SKU-1",
        slug: "product-1",
        name: { ar: "منتج", en: "Product" },
        description: { ar: "", en: "" },
        ingredients: { ar: "", en: "" },
        howToUse: { ar: "", en: "" },
        warnings: { ar: "", en: "" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "/uploads/primary.jpg",
        hoverImagePath: "",
        media: [
          { type: "image", url: "/uploads/primary.jpg" },
          { type: "image", url: "/uploads/gallery-secondary.jpg" }
        ],
        status: "active",
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      }
    }));

    const card = screen.getByRole("link");
    const image = screen.getByRole("img", { name: "Product" });

    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
    fireEvent.mouseEnter(card);
    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
    fireEvent.mouseLeave(card);
    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
  });
});
