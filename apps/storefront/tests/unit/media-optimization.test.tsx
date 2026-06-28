import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt, src, fill, sizes, priority, ...rest }: any) =>
    createElement("img", {
      alt,
      src: typeof src === "string" ? src : src?.src,
      "data-next-image": "true",
      "data-fill": fill ? "true" : "false",
      "data-priority": priority ? "true" : "false",
      sizes,
      ...rest
    })
}));

import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";

describe("media optimization", () => {
  it("renders uploaded product media through next/image", () => {
    render(
      <ProductIllustration
        product={{
          slug: "body-oil",
          name: { ar: "زيت", en: "Body Oil" },
          imagePath: "https://api.capellacares.com/uploads/body-oil.png"
        }}
      />
    );

    expect(screen.getByRole("img", { name: "Body Oil" })).toHaveAttribute("data-next-image", "true");
    expect(screen.getByRole("img", { name: "Body Oil" })).toHaveAttribute("data-fill", "false");
  });

  it("renders uploaded offer media through next/image", () => {
    render(
      <OfferIllustration
        offer={{
          slug: "offer-1",
          name: { ar: "عرض", en: "Offer One" },
          imagePath: "https://api.capellacares.com/uploads/offer.png"
        }}
      />
    );

    expect(screen.getByRole("img", { name: "Offer One" })).toHaveAttribute("data-next-image", "true");
    expect(screen.getByRole("img", { name: "Offer One" })).toHaveAttribute("data-fill", "false");
  });

  it("renders uploaded collection media through next/image", () => {
    render(
      <CollectionIllustration
        lang="en"
        collection={{
          slug: "collection-1",
          name: { ar: "مجموعة", en: "Collection One" },
          imagePath: "https://api.capellacares.com/uploads/collection.png"
        }}
      />
    );

    expect(screen.getByRole("img", { name: "Collection One" })).toHaveAttribute("data-next-image", "true");
    expect(screen.getByRole("img", { name: "Collection One" })).toHaveAttribute("data-fill", "false");
  });
});
