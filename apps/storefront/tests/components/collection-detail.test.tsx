import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
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
  common: { buyNow: "Buy now", save: "Save", addToWishlist: "Wishlist", share: "Share", linkCopied: "Link copied" }
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
  it("renders the ordered collection media gallery", () => {
    render(createElement(CollectionDetail, {
      collection: {
        ...collection,
        imagePath: "/uploads/collection-main.jpg",
        media: [
          { type: "image", url: "/uploads/collection-main.jpg" },
          { type: "image", url: "/uploads/collection-detail.jpg" }
        ]
      },
      items: [],
      lang: "en",
      dict,
      relatedItems: []
    }));

    expect(screen.getByTestId("collection-media-dots").children).toHaveLength(2);
    fireEvent.click(screen.getByTestId("collection-media-thumbs").querySelectorAll("button")[1]!);
    expect(screen.getByTestId("collection-media-main").querySelector("img")).toHaveAttribute("src", "/uploads/collection-detail.jpg");
  });

  it("adds the collection to wishlist", () => {
    render(createElement(CollectionDetail, { collection, items: [], lang: "en", dict, relatedItems: [] }));

    fireEvent.click(screen.getByRole("button", { name: "Save collection" }));
    expect(toggle).toHaveBeenCalledWith("collection", 2);
  });

  it("floats the collection tag top-start and the wishlist heart top-end, styled like the card tags", () => {
    render(createElement(CollectionDetail, { collection, items: [], lang: "en", dict, relatedItems: [] }));

    const frame = screen.getByTestId("collection-media-main").parentElement as HTMLElement;

    const tag = frame.querySelector("span.absolute") as HTMLElement;
    expect(tag).toHaveTextContent("Collection");
    expect(tag.className).toContain("top-0");
    expect(tag.className).toContain("inset-s-0");
    expect(tag.className).toContain("rounded-ss-lg");
    expect(tag.className).not.toContain("inset-e-0");

    const heart = frame.querySelector("button") as HTMLElement;
    expect(heart).toHaveAttribute("aria-label", "Save collection");
    expect(heart.className).toContain("inset-e-2");
    expect(heart.className).not.toContain("inset-s-2");
  });

  it("shows the collection rating summary on the detail page", () => {
    const reviewData = {
      summary: { averageRating: 4, reviewCount: 3, distribution: { "1": 0, "2": 0, "3": 1, "4": 1, "5": 1 } },
      items: [],
      pagination: { page: 1, pageSize: 10, total: 3, totalPages: 1 }
    };
    const reviews = { title: "Customer reviews", outOfFive: "{rating} out of 5", reviewCount: "{count} reviews", verifiedPurchase: "Verified purchase", close: "Close", noReviews: "No reviews yet" };

    render(createElement(CollectionDetail, { collection: { ...collection, reviewData }, items: [], lang: "en", dict: { ...dict, reviews } }));

    expect(screen.getByRole("button", { name: "4.0 out of 5, 3 reviews" })).toBeInTheDocument();
  });
});
