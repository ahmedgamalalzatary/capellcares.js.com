import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OfferDetail } from "@/components/offers/offer-detail";
import { offers, products } from "@capella/shared/mock";

vi.mock("next/link", () => ({
  default: (props: any) => {
    const { children, href, ...rest } = props;
    return createElement("a", { href, ...rest }, children);
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({
    add: vi.fn()
  })
}));

const dict = {
  offers: {
    badge: "Offer",
    includes: "Includes",
    addBundleToCart: "Add bundle",
    save: "Save {amount}"
  },
  common: {
    quantity: "Quantity",
    buyNow: "Buy now"
  }
};

describe("OfferDetail", () => {
  it("disables purchase and shows out-of-stock state when one bundle item is unavailable", () => {
    render(createElement(OfferDetail, {
      offer: offers[1]!,
      items: [
        {
          qty: 1,
          variantId: products[1]!.variants[0]!.id,
          product: products[1]!,
          size: products[1]!.variants[0]!.size,
          unitPrice: products[1]!.variants[0]!.price,
          available: 0
        }
      ],
      lang: "en",
      dict
    }));

    expect(screen.getByRole("button", { name: /add bundle/i })).toBeDisabled();
    expect(screen.getByText(/currently unavailable/i)).toBeInTheDocument();
  });

  it("renders the uploaded offer image when imagePath exists", () => {
    render(createElement(OfferDetail, {
      offer: {
        ...offers[0]!,
        imagePath: "/uploads/offers/real-offer-photo.jpg"
      },
      items: [
        {
          qty: 1,
          variantId: products[0]!.variants[0]!.id,
          product: products[0]!,
          size: products[0]!.variants[0]!.size,
          unitPrice: products[0]!.variants[0]!.price,
          available: products[0]!.variants[0]!.stock
        }
      ],
      lang: "en",
      dict
    }));

    const image = screen.getByRole("img", { name: /rose ritual bundle/i });
    expect(image).toHaveAttribute("src", "/uploads/offers/real-offer-photo.jpg");
  });
});
