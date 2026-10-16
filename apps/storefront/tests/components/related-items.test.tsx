import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

const add = vi.fn();
const cartLines: any[] = [];
const cartSetQty = vi.fn();
const cartRemove = vi.fn();
vi.mock("@/components/providers/cart-provider", async () => {
  const { cartKeyOf } = await import("../helpers/cart");
  return {
    useCart: () => ({
      add,
      lines: cartLines,
      count: 0,
      setQty: cartSetQty,
      remove: cartRemove,
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

import { RelatedItems } from "@/components/products/related-items";

const dict = {
  common: { addToCart: "Add to cart", added: "Added", addToWishlist: "Wishlist", quantity: "Quantity" },
  offers: { badge: "Offer" },
  collections: { badge: "Set" }
};

describe("RelatedItems", () => {
  const items = [
    {
      type: "product" as const,
      id: 1,
      slug: "serum",
      name: { ar: "سيروم", en: "Serum" },
      imagePath: "/uploads/serum.jpg",
      price: 100,
      variantId: 11,
      originalTotal: 130,
      categoryName: { ar: "عناية", en: "Fine Fragrance Mist" },
      rating: { average: 0, count: 0 }
    }
  ];

  beforeEach(() => {
    add.mockClear();
    toggle.mockClear();
    has.mockReturnValue(false);
    cartLines.length = 0;
    cartSetQty.mockClear();
    cartRemove.mockClear();
  });

  it("slides through the related item's main, hover and gallery pictures like the catalog cards", () => {
    render(createElement(RelatedItems, {
      items: [{
        ...items[0]!,
        hoverImagePath: "/uploads/serum-hover.jpg",
        media: [
          { type: "image" as const, arUrl: null, enUrl: "/uploads/serum.jpg" },
          { type: "image" as const, arUrl: null, enUrl: "/uploads/serum-side.jpg" }
        ]
      }],
      lang: "en",
      dict,
      title: "Related"
    }));

    expect(Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src")))
      .toEqual(["/uploads/serum.jpg", "/uploads/serum-hover.jpg", "/uploads/serum-side.jpg"]);
    fireEvent.click(screen.getByRole("button", { name: "Next media" }));
    expect(screen.getByRole("img", { name: "Serum" })).toHaveAttribute("src", "/uploads/serum-hover.jpg");
  });

  it("shows the quantity stepper for a related product already in the cart", () => {
    cartLines.push({ type: "product", productId: 1, variantId: 11, qty: 2 });

    render(createElement(RelatedItems, { items, lang: "en", dict, title: "Related" }));

    expect(screen.getByText("Quantity: 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(cartSetQty).toHaveBeenCalledWith("p:1:11", 3);
  });

  it("adds a related product to the cart using its cheapest in-stock variant", () => {
    render(createElement(RelatedItems, { items, lang: "en", dict, title: "Related" }));

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(add).toHaveBeenCalledWith({ type: "product", productId: 1, variantId: 11, qty: 1 });
  });

  it("adds a related offer to the cart by its own id and badges it", () => {
    render(createElement(RelatedItems, {
      items: [{
        type: "offer" as const,
        id: 7,
        slug: "duo",
        name: { ar: "عرض", en: "Duo" },
        imagePath: "/uploads/duo.jpg",
        price: 70,
        variantId: null,
        originalTotal: 90,
        categoryName: null,
        rating: { average: 0, count: 0 }
      }],
      lang: "en",
      dict,
      title: "Related"
    }));

    expect(screen.getByText("Offer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(add).toHaveBeenCalledWith({ type: "offer", offerId: 7, qty: 1 });
  });

  it("shows the product's category as the classification line under its name", () => {
    render(createElement(RelatedItems, { items, lang: "en", dict, title: "Related" }));

    expect(screen.getByText("Fine Fragrance Mist")).toBeInTheDocument();
  });

  it("shows no classification line for a bundle, matching SectionCard", () => {
    render(createElement(RelatedItems, {
      items: [{
        type: "collection" as const,
        id: 8,
        slug: "glow",
        name: { ar: "مجموعة", en: "Glow Set" },
        imagePath: "/uploads/glow.jpg",
        price: 65,
        variantId: null,
        originalTotal: 90,
        categoryName: null,
        rating: { average: 0, count: 0 }
      }],
      lang: "en",
      dict,
      title: "Related"
    }));

    expect(screen.getByText("Set")).toBeInTheDocument();
    expect(screen.queryByText("Fine Fragrance Mist")).toBeNull();
  });

  it("withholds the action row from a product with nothing purchasable, like ProductCard does when out of stock", () => {
    render(createElement(RelatedItems, {
      items: [{ ...items[0]!, variantId: null }],
      lang: "en",
      dict,
      title: "Related"
    }));

    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
    // The card itself still renders and still links through.
    expect(screen.getByRole("heading", { name: "Serum" })).toBeInTheDocument();
  });

  it("shows the original price struck through beside the discounted one", () => {
    const { container } = render(createElement(RelatedItems, { items, lang: "en", dict, title: "Related" }));

    expect(container.querySelector(".line-through")).toHaveTextContent(/130/);
  });

  it("hides the struck-through original when it is not a genuine saving, like the detail views", () => {
    const { container } = render(createElement(RelatedItems, {
      items: [{ ...items[0]!, price: 130, originalTotal: 130 }],
      lang: "en",
      dict,
      title: "Related"
    }));

    expect(container.querySelector(".line-through")).toBeNull();
  });

  it("toggles the wishlist from the heart floating on the image", () => {
    render(createElement(RelatedItems, { items, lang: "en", dict, title: "Related" }));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(toggle).toHaveBeenCalledWith("product", 1);
  });

});
