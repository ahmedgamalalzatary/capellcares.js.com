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

describe("SectionCard hover image", () => {
  it("switches an offer card to the dedicated hover image on hover when one exists", () => {
    render(createElement(SectionCard, { kind: "offer", data: offer, lang: "en", dict }));

    const card = screen.getByLabelText("Offer");
    const image = screen.getByRole("img", { name: "Offer" });

    expect(image).toHaveAttribute("src", "/uploads/offer-primary.jpg");
    fireEvent.mouseEnter(card);
    expect(image).toHaveAttribute("src", "/uploads/offer-hover.jpg");
    fireEvent.mouseLeave(card);
    expect(image).toHaveAttribute("src", "/uploads/offer-primary.jpg");
  });

  it("switches a collection card to the dedicated hover image on hover when one exists", () => {
    render(createElement(SectionCard, { kind: "collection", data: collection, lang: "en", dict }));

    const card = screen.getByLabelText("Collection");
    const image = screen.getByRole("img", { name: "Collection" });

    expect(image).toHaveAttribute("src", "/uploads/collection-primary.jpg");
    fireEvent.mouseEnter(card);
    expect(image).toHaveAttribute("src", "/uploads/collection-hover.jpg");
    fireEvent.mouseLeave(card);
    expect(image).toHaveAttribute("src", "/uploads/collection-primary.jpg");
  });

  it("keeps the primary image on hover when no dedicated hover image exists", () => {
    render(createElement(SectionCard, {
      kind: "offer",
      data: { ...offer, hoverImagePath: "" },
      lang: "en",
      dict
    }));

    const card = screen.getByLabelText("Offer");
    const image = screen.getByRole("img", { name: "Offer" });

    expect(image).toHaveAttribute("src", "/uploads/offer-primary.jpg");
    fireEvent.mouseEnter(card);
    expect(image).toHaveAttribute("src", "/uploads/offer-primary.jpg");
    fireEvent.mouseLeave(card);
    expect(image).toHaveAttribute("src", "/uploads/offer-primary.jpg");
  });
});
