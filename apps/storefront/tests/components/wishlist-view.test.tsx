import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

const remove = vi.fn();

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({
    ids: ["product:11", "offer:7", "collection:3"],
    items: [
      {
        entityType: "product",
        entityId: 11,
        name: { ar: "بودي ميست", en: "Body Mist" },
        imagePath: "/uploads/product.jpg",
        href: "/products/body-mist",
        availability: "available"
      },
      {
        entityType: "offer",
        entityId: 7,
        name: { ar: "عرض", en: "Bundle Offer" },
        imagePath: "/uploads/offer.jpg",
        href: "/offers/bundle-offer",
        availability: "available"
      },
      {
        entityType: "collection",
        entityId: 3,
        name: { ar: "تجميعة مخفية", en: "Hidden Collection" },
        imagePath: "/uploads/collection.jpg",
        href: null,
        availability: "unavailable"
      }
    ],
    has: vi.fn(),
    toggle: vi.fn(),
    remove
  })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

import { WishlistView } from "@/components/wishlist/wishlist-view";

const dict = {
  common: { loading: "Loading", outOfStock: "Unavailable", removeFromWishlist: "Remove" },
  wishlist: {
    loginRequired: "Login required",
    loginRequiredDesc: "Login first",
    goLogin: "Log in",
    empty: "Empty",
    savedEmpty: "Nothing saved",
    itemTypes: {
      product: "Product",
      offer: "Offer",
      collection: "Collection"
    }
  },
  cart: { keepShopping: "Keep shopping" }
};

describe("WishlistView", () => {
  it("renders mixed saved items and allows removing unavailable ones", () => {
    render(createElement(WishlistView, { lang: "en", dict }));

    expect(screen.getByRole("link", { name: "Body Mist" })).toHaveAttribute("href", "/en/products/body-mist");
    expect(screen.getByRole("link", { name: "Bundle Offer" })).toHaveAttribute("href", "/en/offers/bundle-offer");
    expect(screen.queryByRole("link", { name: "Hidden Collection" })).toBeNull();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[2]!);
    expect(remove).toHaveBeenCalledWith("collection", 3);
  });
});
