import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  has.mockReturnValue(false);
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

const cartAdd = vi.fn();
vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({
    add: cartAdd,
    lines: [],
    count: 0,
    setQty: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    keyOf: (line: any) => `${line.type}:${line.offerId ?? line.collectionId}`
  })
}));

import { SectionCard } from "@/components/shop/section-card";
import { useCardSliderScreen } from "../helpers/media-query";

const dict = {
  common: { addToWishlist: "Wishlist" },
  offers: { badge: "Offer" },
  collections: { badge: "Collection" },
  reviews: { noReviews: "No reviews yet" }
};

const offer = {
  id: 1,
  slug: "offer-1",
  name: { ar: "عرض", en: "Offer" },
  description: { ar: "", en: "" },
  imagePath: "/uploads/offer-primary.jpg",
  hoverImagePath: "/uploads/offer-hover.jpg",
  media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/offer-primary.jpg" }],
  price: 100,
  originalTotal: 150,
  categoryId: 5,
  items: [{ variantId: 11, qty: 1 }],
  stock: 5,
  status: "active" as const,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

const collection = {
  id: 2,
  slug: "collection-1",
  name: { ar: "مجموعة", en: "Collection" },
  description: { ar: "", en: "" },
  imagePath: "/uploads/collection-primary.jpg",
  hoverImagePath: "/uploads/collection-hover.jpg",
  media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/collection-primary.jpg" }],
  price: 120,
  originalTotal: 180,
  categoryId: 5,
  items: [{ variantId: 12, qty: 1 }],
  stock: 3,
  status: "active" as const,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

const slideSources = () => Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"));

describe("SectionCard images", () => {
  it("shows an offer's main image on desktop and swaps to its hover image while hovered", () => {
    render(createElement(SectionCard, { kind: "offer", data: offer, lang: "en", dict }));

    expect(slideSources()).toEqual(["/uploads/offer-primary.jpg"]);
    fireEvent.mouseEnter(screen.getByLabelText("Offer"));
    expect(screen.getByRole("img", { name: "Offer" })).toHaveAttribute("src", "/uploads/offer-hover.jpg");
    fireEvent.mouseLeave(screen.getByLabelText("Offer"));
    expect(screen.getByRole("img", { name: "Offer" })).toHaveAttribute("src", "/uploads/offer-primary.jpg");
  });

  it("swipes a collection through its gallery on touch screens, without the hover image", () => {
    useCardSliderScreen();
    render(createElement(SectionCard, {
      kind: "collection",
      data: {
        ...collection,
        media: [...collection.media, { type: "image" as const, arUrl: null, enUrl: "/uploads/collection-third.jpg" }]
      },
      lang: "en",
      dict
    }));

    expect(slideSources()).not.toContain("/uploads/collection-hover.jpg");
    expect(new Set(slideSources())).toEqual(new Set(["/uploads/collection-primary.jpg", "/uploads/collection-third.jpg"]));
  });

  it("keeps the main image on hover when there is no hover image", () => {
    render(createElement(SectionCard, { kind: "offer", data: { ...offer, hoverImagePath: "" }, lang: "en", dict }));

    fireEvent.mouseEnter(screen.getByLabelText("Offer"));
    expect(screen.getByRole("img", { name: "Offer" })).toHaveAttribute("src", "/uploads/offer-primary.jpg");
  });
});
