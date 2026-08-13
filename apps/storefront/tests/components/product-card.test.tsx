import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  has.mockReturnValue(false);
  cartLines.length = 0;
  cartAdd.mockClear();
  cartSetQty.mockClear();
  cartRemove.mockClear();
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

const has = vi.fn(() => false);

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has, toggle: vi.fn() })
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
          { type: "image", arUrl: null, enUrl: "/uploads/primary.jpg" },
          { type: "image", arUrl: null, enUrl: "/uploads/gallery-secondary.jpg" }
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
          { type: "image", arUrl: null, enUrl: "/uploads/primary.jpg" },
          { type: "image", arUrl: null, enUrl: "/uploads/gallery-secondary.jpg" }
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

  it("keeps the heart's background when the product is saved — only the glyph fills", () => {
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
      imagePath: "/uploads/primary.jpg",
      status: "active" as const,
      isNew: false,
      isBestseller: false,
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    };

    const { rerender } = render(createElement(ProductCard, { lang: "en", dict, product }));
    const idleClass = screen.getByRole("button", { name: "Wishlist" }).className;

    has.mockReturnValue(true);
    rerender(createElement(ProductCard, { lang: "en", dict, product }));

    const saved = screen.getByRole("button", { name: "Wishlist" });
    expect(saved.className).toBe(idleClass);
    expect(saved.className).not.toContain("bg-accent");
    expect(saved.querySelector("svg")).toHaveAttribute("fill", "currentColor");
  });

  it("gives the whole action row to Add to cart, with no View button", () => {
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

    // Counted, not queried by name: a restored View link would render an empty
    // accessible name now that common.view is gone, and slip past a name query.
    const actionRow = document.querySelector(".mt-3.flex.gap-2") as HTMLElement;
    expect(actionRow.children).toHaveLength(1);
    expect(actionRow.querySelector("a")).toBeNull();
    expect(actionRow.querySelector("button")).toHaveTextContent("Add to cart");

    // The image and the heading still link to the detail page.
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/en/products/product-1"));
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
});
