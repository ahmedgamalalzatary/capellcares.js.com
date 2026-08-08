import { createElement } from "react";
import { render, screen } from "@testing-library/react";
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

vi.mock("@/components/providers/cart-provider", async () => {
  const { cartKeyOf } = await import("../helpers/cart");
  return {
    useCart: () => ({
      add: vi.fn(),
      lines: [],
      count: 0,
      setQty: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      keyOf: cartKeyOf
    })
  };
});

import { ProductCard } from "@/components/products/product-card";
import { RelatedItems } from "@/components/products/related-items";
import { SectionCard } from "@/components/shop/section-card";

const dict = {
  badges: { new: "New", bestseller: "Bestseller", offer: "Offer" },
  common: { outOfStock: "Out", addToWishlist: "Wishlist", addToCart: "Add to cart", added: "Added" },
  offers: { badge: "Offer" },
  collections: { badge: "Set" },
  reviews: { outOfFive: "{rating} out of 5", reviewCount: "{count} reviews" }
};

function productWith(rating?: { average: number; count: number }) {
  return {
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
    rating,
    createdAt: "",
    updatedAt: ""
  };
}

function offerWith(rating?: { average: number; count: number }) {
  return {
    id: 7,
    slug: "duo",
    name: { ar: "عرض", en: "Duo" },
    description: { ar: "وصف", en: "Two products" },
    imagePath: "/uploads/duo.jpg",
    price: 70,
    originalTotal: 90,
    items: [{ variantId: 11, qty: 1 }],
    stock: 3,
    status: "active" as const,
    categoryId: 5,
    visibility: "visible" as const,
    rating,
    createdAt: "",
    updatedAt: ""
  };
}

function collectionWith(rating?: { average: number; count: number }) {
  return {
    id: 9,
    slug: "ritual",
    name: { ar: "مجموعة", en: "Ritual" },
    description: { ar: "وصف", en: "A set" },
    imagePath: "/uploads/ritual.jpg",
    price: 120,
    originalTotal: 150,
    categoryId: 5,
    items: [{ variantId: 11, qty: 1 }],
    stock: 2,
    status: "active" as const,
    visibility: "visible" as const,
    rating,
    createdAt: "",
    updatedAt: ""
  };
}

function relatedProductWith(rating: { average: number; count: number }) {
  return {
    type: "product" as const,
    id: 1,
    slug: "serum",
    name: { ar: "سيروم", en: "Serum" },
    imagePath: "/uploads/serum.jpg",
    price: 100,
    variantId: 11,
    originalTotal: null,
    categoryName: null,
    rating
  };
}

/** The stars must sit above the price, not after it, on every card. */
function expectRatingAbovePrice(pricePattern: RegExp) {
  const rating = screen.getByTestId("card-rating");
  const price = screen.getByText(pricePattern);
  expect(rating.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("card ratings", () => {
  it("shows a product card's average rating and review count above the price", () => {
    render(createElement(ProductCard, { lang: "en", dict, product: productWith({ average: 4.5, count: 12 }) }));

    expect(screen.getByRole("img", { name: "4.5 out of 5, 12 reviews" })).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
    expectRatingAbovePrice(/50/);
  });

  it("renders a whole average with one decimal so cards line up", () => {
    render(createElement(ProductCard, { lang: "en", dict, product: productWith({ average: 4, count: 3 }) }));

    expect(screen.getByText("4.0")).toBeInTheDocument();
  });

  it("omits the rating on a product card nobody has reviewed", () => {
    render(createElement(ProductCard, { lang: "en", dict, product: productWith({ average: 0, count: 0 }) }));

    expect(screen.queryByTestId("card-rating")).toBeNull();
  });

  it("omits the rating on a product card whose payload carries none", () => {
    render(createElement(ProductCard, { lang: "en", dict, product: productWith(undefined) }));

    expect(screen.queryByTestId("card-rating")).toBeNull();
  });

  it("shows an offer card's average rating above the price", () => {
    render(createElement(SectionCard, { kind: "offer", lang: "en", dict, data: offerWith({ average: 3.5, count: 4 }) }));

    expect(screen.getByRole("img", { name: "3.5 out of 5, 4 reviews" })).toBeInTheDocument();
    expectRatingAbovePrice(/70/);
  });

  it("omits the rating on an unreviewed offer card", () => {
    render(createElement(SectionCard, { kind: "offer", lang: "en", dict, data: offerWith({ average: 0, count: 0 }) }));

    expect(screen.queryByTestId("card-rating")).toBeNull();
  });

  it("shows a collection card's average rating above the price", () => {
    render(createElement(SectionCard, { kind: "collection", lang: "en", dict, data: collectionWith({ average: 5, count: 2 }) }));

    expect(screen.getByRole("img", { name: "5.0 out of 5, 2 reviews" })).toBeInTheDocument();
    expectRatingAbovePrice(/120/);
  });

  it("omits the rating on an unreviewed collection card", () => {
    render(createElement(SectionCard, { kind: "collection", lang: "en", dict, data: collectionWith({ average: 0, count: 0 }) }));

    expect(screen.queryByTestId("card-rating")).toBeNull();
  });

  it("shows a related item card's average rating above the price", () => {
    render(createElement(RelatedItems, {
      items: [relatedProductWith({ average: 2.5, count: 8 })],
      lang: "en",
      dict,
      title: "Related"
    }));

    expect(screen.getByRole("img", { name: "2.5 out of 5, 8 reviews" })).toBeInTheDocument();
    expectRatingAbovePrice(/100/);
  });

  it("omits the rating on an unreviewed related item card", () => {
    render(createElement(RelatedItems, {
      items: [relatedProductWith({ average: 0, count: 0 })],
      lang: "en",
      dict,
      title: "Related"
    }));

    expect(screen.queryByTestId("card-rating")).toBeNull();
  });

  it("localizes the rating label from the active dictionary", () => {
    const arDict = { ...dict, reviews: { outOfFive: "{rating} من 5", reviewCount: "{count} تقييم" } };
    render(createElement(ProductCard, { lang: "ar", dict: arDict, product: productWith({ average: 4.5, count: 12 }) }));

    expect(screen.getByRole("img", { name: "٤٫٥ من 5, ١٢ تقييم" })).toBeInTheDocument();
    expect(screen.getByText("٤٫٥")).toBeInTheDocument();
    expect(screen.getByText("(١٢)")).toBeInTheDocument();
  });

  it("passes the active locale through related cards", () => {
    const arDict = { ...dict, reviews: { outOfFive: "{rating} من 5", reviewCount: "{count} تقييم" } };
    render(createElement(RelatedItems, {
      items: [relatedProductWith({ average: 2.5, count: 8 })],
      lang: "ar",
      dict: arDict,
      title: "Related"
    }));

    expect(screen.getByRole("img", { name: "٢٫٥ من 5, ٨ تقييم" })).toBeInTheDocument();
  });
});
