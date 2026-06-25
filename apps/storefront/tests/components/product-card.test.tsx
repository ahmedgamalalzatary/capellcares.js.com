import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
});

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

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ add: vi.fn(), lines: [], count: 0, setQty: vi.fn(), remove: vi.fn(), clear: vi.fn(), keyOf: vi.fn() })
}));

import { ProductCard } from "@/components/products/product-card";

const dict = {
  badges: { new: "New", bestseller: "Bestseller", offer: "Offer" },
  common: {
    outOfStock: "Out",
    addToWishlist: "Wishlist",
    addToCart: "Add to cart",
    added: "Added",
    buyNow: "Buy now",
    view: "View"
  },
  nav: { cart: "Cart" }
};

describe("ProductCard", () => {
  it("switches to the dedicated hover image on hover when one exists", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict,
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

    const card = screen.getByLabelText("Product");
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
      dict,
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

    const card = screen.getByLabelText("Product");
    const image = screen.getByRole("img", { name: "Product" });

    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
    fireEvent.mouseEnter(card);
    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
    fireEvent.mouseLeave(card);
    expect(image).toHaveAttribute("src", "/uploads/primary.jpg");
  });

  it("stacks the name, category and price as text below the image", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict,
      categoryName: "Fine Fragrance Mist",
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
        status: "active",
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      }
    }));

    // Name, category and price all render as plain text (not overlaid on the image).
    expect(screen.getByRole("heading", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByText("Fine Fragrance Mist")).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it("omits the category line when no category name is provided", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict,
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
        status: "active",
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      }
    }));

    expect(screen.queryByText("Fine Fragrance Mist")).toBeNull();
  });

  it("shows the offer badge when the product carries offerIds", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict,
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
        status: "active",
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        offerIds: [3],
        createdAt: "",
        updatedAt: ""
      }
    }));

    expect(screen.getByText("Offer")).toBeInTheDocument();
  });

  it("uses the shared common.added label after adding to cart", () => {
    vi.useFakeTimers();

    render(createElement(ProductCard, {
      lang: "en",
      dict,
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
        status: "active",
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      }
    }));

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(screen.getByText("Added")).toBeInTheDocument();
  });
});
