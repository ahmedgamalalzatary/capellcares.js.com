import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  vi.clearAllMocks();
  has.mockReturnValue(false);
});
import { OfferDetail } from "@/components/offers/offer-detail";

const dict = {
  offers: {
    badge: "Offer",
    bundleEyebrow: "Bundle",
    save: "Save {amount}",
    includes: "Includes",
    added: "Added",
    addBundleToCart: "Add bundle",
    unavailable: "Unavailable",
    related: "You may also like",
    saveToWishlist: "Save offer"
  },
  common: { buyNow: "Buy now", addToWishlist: "Wishlist" }
};

const offer = {
  id: 1,
  slug: "offer-1",
  name: { ar: "عرض", en: "Offer" },
  description: { ar: "", en: "Description" },
  imagePath: "",
  price: 80,
  originalTotal: 100,
  items: [],
  stock: 3,
  status: "active" as const,
  createdAt: "",
  updatedAt: ""
};

describe("OfferDetail", () => {
  it("renders related items in order with links to their detail pages", () => {
    render(createElement(OfferDetail, {
      offer,
      items: [],
      lang: "en",
      dict,
      relatedItems: [
        { type: "product", id: 2, slug: "related-product", name: { ar: "", en: "Related Product" }, imagePath: "/uploads/related-product.jpg", price: 30 },
        { type: "offer", id: 3, slug: "related-offer", name: { ar: "", en: "Related Offer" }, imagePath: "/uploads/related-offer.jpg", price: 40 }
      ]
    }));

    const rows = screen.getAllByTestId("related-item");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector("a")).toHaveAttribute("href", "/en/products/related-product");
    expect(rows[1]!.querySelector("a")).toHaveAttribute("href", "/en/offers/related-offer");
    expect(screen.getByRole("img", { name: "Related Product" })).toHaveAttribute("src", "/uploads/related-product.jpg");
    expect(screen.getByRole("img", { name: "Related Offer" })).toHaveAttribute("src", "/uploads/related-offer.jpg");
  });

  it("renders no related section when there are none", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));
    expect(screen.queryByTestId("related-items")).toBeNull();
  });

  it("adds the offer to wishlist", () => {
    render(createElement(OfferDetail, { offer, items: [], lang: "en", dict, relatedItems: [] }));

    fireEvent.click(screen.getByRole("button", { name: "Save offer" }));
    expect(toggle).toHaveBeenCalledWith("offer", 1);
  });
});
