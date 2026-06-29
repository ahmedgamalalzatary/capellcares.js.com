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
        added: "Added",
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

  it("switches product media when the user drags on the main media area or thumbnail row", () => {
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
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
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
        media: [
          { type: "image" as const, url: "/uploads/primary.jpg" },
          { type: "image" as const, url: "/uploads/secondary.jpg" },
          { type: "video" as const, url: "/uploads/demo.mp4" }
        ],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/primary.jpg");

    fireEvent.pointerDown(screen.getByTestId("product-media-main"), { clientX: 260, clientY: 100, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    fireEvent.pointerUp(screen.getByTestId("product-media-main"), { clientX: 120, clientY: 110, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/secondary.jpg");

    fireEvent.pointerDown(screen.getByTestId("product-media-main"), { clientX: 260, clientY: 100, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    fireEvent.pointerUp(screen.getByTestId("product-media-main"), { clientX: 120, clientY: 110, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true });
    expect(document.querySelector("video[controls]")).toHaveAttribute("src", "/uploads/demo.mp4");

    fireEvent.pointerDown(screen.getByTestId("product-media-thumbs"), { clientX: 120, clientY: 100, pointerId: 2, pointerType: "touch", button: 0, isPrimary: true });
    fireEvent.pointerUp(screen.getByTestId("product-media-thumbs"), { clientX: 260, clientY: 105, pointerId: 2, pointerType: "touch", button: 0, isPrimary: true });
    expect(screen.getAllByRole("img", { name: "Product" })[0]).toHaveAttribute("src", "/uploads/secondary.jpg");
  });

  it("renders related items in order with links to their detail pages", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        related: "You may also like"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const product = {
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
      media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    render(createElement(ProductDetail, {
      product,
      offers: [],
      lang: "en",
      dict,
      relatedItems: [
        { type: "product", id: 2, slug: "related-product", name: { ar: "", en: "Related Product" }, imagePath: "/uploads/related-product.jpg", price: 30 },
        { type: "offer", id: 3, slug: "related-offer", name: { ar: "", en: "Related Offer" }, imagePath: "/uploads/related-offer.jpg", price: 40 }
      ]
    }));

    const rows = screen.getAllByTestId("related-item");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Related Product");
    expect(rows[0]!.querySelector("a")).toHaveAttribute("href", "/en/products/related-product");
    expect(screen.getByRole("img", { name: "Related Product" })).toHaveAttribute("src", "/uploads/related-product.jpg");
    expect(rows[0]).toHaveTextContent("Product");
    expect(rows[0]).toHaveTextContent("30");
    expect(rows[1]).toHaveTextContent("Related Offer");
    expect(rows[1]!.querySelector("a")).toHaveAttribute("href", "/en/offers/related-offer");
    expect(screen.getByRole("img", { name: "Related Offer" })).toHaveAttribute("src", "/uploads/related-offer.jpg");
    expect(rows[1]).toHaveTextContent("Offer");
    expect(rows[1]).toHaveTextContent("40");
  });

  it("renders an unavailable state instead of crashing when the product has no variants", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        related: "You may also like"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    const product = {
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
      media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [],
      createdAt: "",
      updatedAt: ""
    };

    render(createElement(ProductDetail, {
      product,
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByText("Out of stock")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buy now" })).toBeDisabled();
  });

  it("shows out-of-stock instead of a price for a selected zero-stock variant", () => {
    const dict = {
      product: {
        description: "Description",
        ingredients: "Ingredients",
        howToUse: "How to use",
        warnings: "Warnings",
        selectSize: "Select size",
        related: "You may also like"
      },
      badges: { new: "New", bestseller: "Best", offer: "Offer" },
      common: {
        outOfStock: "Out of stock",
        lowStock: "Only {n}",
        inStock: "In stock",
        quantity: "Quantity",
        addToCart: "Add to cart",
        added: "Added",
        buyNow: "Buy now",
        addToWishlist: "Wishlist"
      },
      offers: { save: "Save {amount}" }
    };

    render(createElement(ProductDetail, {
      product: {
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
        media: [{ type: "image" as const, url: "/uploads/legacy.jpg" }],
        status: "active" as const,
        isNew: false,
        isBestseller: false,
        categoryId: 5,
        variants: [
          { id: 11, productId: 1, size: "100ml", price: 50, stock: 0, sortOrder: 1 }
        ],
        createdAt: "",
        updatedAt: ""
      },
      offers: [],
      lang: "en",
      dict
    }));

    expect(screen.getAllByText("Out of stock").length).toBeGreaterThanOrEqual(2);
    const primaryPrice = document.querySelector(".text-3xl, .sm\\:text-\\[40px\\]");
    expect(primaryPrice).toHaveTextContent("Out of stock");
  });
});
