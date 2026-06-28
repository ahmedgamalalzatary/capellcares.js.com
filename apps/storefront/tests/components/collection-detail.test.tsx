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

const has = vi.fn(() => false);
const toggle = vi.fn();

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has, toggle })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

import { CollectionDetail } from "@/components/collections/collection-detail";

const dict = {
  collections: {
    badge: "Collection",
    collectionEyebrow: "Collection",
    categoryLabel: "Category",
    itemsLabel: "Items",
    added: "Added",
    addCollectionToCart: "Add collection",
    unavailable: "Unavailable",
    related: "You may also like",
    saveToWishlist: "Save collection"
  },
  common: { buyNow: "Buy now", save: "Save", addToWishlist: "Wishlist" }
};

const collection = {
  id: 2,
  slug: "collection-1",
  name: { ar: "تجميعة", en: "Collection" },
  description: { ar: "", en: "Description" },
  imagePath: "",
  price: 90,
  originalTotal: 120,
  categoryId: 5,
  items: [],
  stock: 2,
  status: "active" as const,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

describe("CollectionDetail", () => {
  it("adds the collection to wishlist", () => {
    render(createElement(CollectionDetail, { collection, items: [], lang: "en", dict, relatedItems: [] }));

    fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
    expect(toggle).toHaveBeenCalledWith("collection", 2);
  });
});
