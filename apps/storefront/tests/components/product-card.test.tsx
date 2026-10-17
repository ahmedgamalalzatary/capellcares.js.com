import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@capella/shared";

afterEach(() => {
  vi.useRealTimers();
  has.mockReturnValue(false);
  cartLines.length = 0;
  cartAdd.mockClear();
  cartSetQty.mockClear();
  cartRemove.mockClear();
  toggle.mockClear();
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

const has = vi.fn(() => false);
const toggle = vi.fn();

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has, toggle })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

const cartLines: any[] = [];
const cartAdd = vi.fn();
const cartSetQty = vi.fn();
const cartRemove = vi.fn();
vi.mock("@/components/providers/cart-provider", async () => {
  const { cartKeyOf } = await import("../helpers/cart");
  return {
    useCart: () => ({
      add: cartAdd,
      lines: cartLines,
      count: 0,
      setQty: cartSetQty,
      remove: cartRemove,
      clear: vi.fn(),
      keyOf: cartKeyOf
    })
  };
});

import { ProductCard } from "@/components/products/product-card";
import { useCardSliderScreen } from "../helpers/media-query";

const dict = {
  badges: { new: "New", bestseller: "Bestseller", offer: "Offer" },
  common: {
    outOfStock: "Out",
    addToWishlist: "Wishlist",
    addToCart: "Add to cart",
    added: "Added",
    buyNow: "Buy now",
    quantity: "Quantity",
  },
  nav: { cart: "Cart" }
};

describe("ProductCard", () => {
  const galleryProduct = (hoverImagePath: string) => ({
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
    hoverImagePath,
    media: [
      { type: "image" as const, arUrl: null, enUrl: "/uploads/primary.jpg" },
      { type: "image" as const, arUrl: null, enUrl: "/uploads/gallery-secondary.jpg" }
    ],
    status: "active" as const,
    isNew: false,
    isBestseller: false,
    categoryId: 5,
    variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
    createdAt: "",
    updatedAt: ""
  });
  const slideSources = () => Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"));

  it("shows the main image on desktop and swaps to the hover image while hovered", () => {
    render(createElement(ProductCard, { lang: "en", dict, product: galleryProduct("/uploads/hover.jpg") }));

    expect(slideSources()).toEqual(["/uploads/primary.jpg"]);
    fireEvent.mouseEnter(screen.getByLabelText("Product"));
    expect(screen.getByRole("img", { name: "Product" })).toHaveAttribute("src", "/uploads/hover.jpg");
    fireEvent.mouseLeave(screen.getByLabelText("Product"));
    expect(screen.getByRole("img", { name: "Product" })).toHaveAttribute("src", "/uploads/primary.jpg");
  });

  it("swipes through the main image and the gallery on touch screens, without the hover image", () => {
    useCardSliderScreen();
    render(createElement(ProductCard, { lang: "en", dict, product: galleryProduct("/uploads/hover.jpg") }));

    expect(slideSources()).not.toContain("/uploads/hover.jpg");
    expect(new Set(slideSources())).toEqual(new Set(["/uploads/primary.jpg", "/uploads/gallery-secondary.jpg"]));
    expect(screen.getByRole("img", { name: "Product" })).toHaveAttribute("src", "/uploads/primary.jpg");
  });

  it("synchronizes the preview when the localized primary image changes", () => {
    const product = {
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
      imagePath: "/uploads/en-primary.jpg",
      hoverImagePath: "",
      media: [{ type: "image" as const, arUrl: "/uploads/ar-primary.jpg", enUrl: "/uploads/en-primary.jpg" }],
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };
    const view = render(createElement(ProductCard, { lang: "en", dict, product }));

    expect(screen.getByRole("img", { name: "Product" })).toHaveAttribute("src", "/uploads/en-primary.jpg");

    view.rerender(createElement(ProductCard, { lang: "ar", dict, product }));

    expect(screen.getByRole("img", { name: "منتج" })).toHaveAttribute("src", "/uploads/ar-primary.jpg");
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

  it("shows the quantity stepper for a product already in the cart, bounded by its stock", () => {
    cartLines.push({ type: "product", productId: 1, variantId: 11, qty: 2 });

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

    expect(screen.getByText("Quantity: 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add to cart/i })).toBeNull();
    // The cheapest in-stock variant only has 2 units, so + is spent.
    expect(screen.getByRole("button", { name: "+" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(cartSetQty).toHaveBeenCalledWith("p:1:11", 1);
  });

  const makeProduct = (variants: Product["variants"]) => ({
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
    status: "active" as const,
    isNew: false,
    isBestseller: false,
    categoryId: 5,
    variants,
    createdAt: "",
    updatedAt: ""
  });

  it("toggles the wishlist from the card heart", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict,
      product: makeProduct([{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }])
    }));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(toggle).toHaveBeenCalledWith("product", 1);
  });

  it("labels a sold-out product instead of offering a price", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict,
      product: makeProduct([{ id: 11, productId: 1, size: "100ml", price: 50, stock: 0, sortOrder: 1 }])
    }));

    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
  });

  it("adds the cheapest in-stock variant, not the first one, when adding to cart", () => {
    render(createElement(ProductCard, {
      lang: "en",
      dict,
      product: makeProduct([
        { id: 11, productId: 1, size: "100ml", price: 90, stock: 0, sortOrder: 1 },
        { id: 12, productId: 1, size: "50ml", price: 50, stock: 3, sortOrder: 2 }
      ])
    }));

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(cartAdd).toHaveBeenCalledWith({ type: "product", productId: 1, variantId: 12, qty: 1 });
  });
});
