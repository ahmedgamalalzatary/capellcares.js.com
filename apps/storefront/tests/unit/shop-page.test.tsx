import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@capella/shared", async () => {
  const actual = await vi.importActual<any>("@capella/shared");
  return {
    ...actual,
    getDict: () => ({
      shop: {
        eyebrow: "Shop",
        heading: "Capella Shop",
        description: "Description",
        bundlesEyebrow: "Offers",
        newAndBestsellers: "Featured",
        featuredHeading: "Products",
        viewAllOffers: "All offers",
        viewAllProducts: "All products",
        collectionsEyebrow: "Collections",
        viewAllCollections: "All collections"
      },
      home: {
        heroEyebrow: "Sterling Silver",
        heroTitleBefore: "Wear the ",
        heroTitleEm: "gold",
        heroTitleAfter: " of the eye.",
        heroLede: "Lede",
        heroCtaShop: "Shop the collection",
        heroCtaNew: "New arrivals",
        trust: {
          "925 Sterling": "Hallmarked silver",
          "Gilt Finish": "Warm 18k plating"
        },
        bannerIdx: "The Atelier",
        bannerTitleBefore: "Struck in silver, ",
        bannerTitleEm: "finished in gold.",
        bannerText: "Banner text",
        bannerCta: "Our story"
      },
      common: { save: "Save" },
      offers: { title: "Offers", badge: "Offer", save: "Save {amount}" },
      collections: { title: "Collections", badge: "Collection" }
    })
  };
});

vi.mock("@/components/products/advice-section", () => ({
  AdviceSection: () => createElement("section", null, "Advice")
}));

vi.mock("@/components/products/product-card", () => ({
  ProductCard: ({ product }: any) => createElement("div", null, product.name.en)
}));

vi.mock("@/components/ui/offer-illustration", () => ({
  OfferIllustration: () => createElement("div", null, "Offer art")
}));

vi.mock("@/components/ui/collection-illustration", () => ({
  CollectionIllustration: () => createElement("div", null, "Collection art")
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

vi.mock("@/lib/storefront-static-data", () => ({
  loadShopPageData: async () => ({
    products: [],
    offers: [],
    advices: [],
    collections: [
      {
        id: 1,
        slug: "skin-care-set",
        name: { ar: "مجموعة", en: "Skin Care Set" },
        description: { ar: "وصف", en: "Routine set" },
        imagePath: "/uploads/collection.jpg",
        price: 200,
        originalTotal: 260,
        categoryId: 11,
        items: [{ variantId: 101, qty: 1 }, { variantId: 102, qty: 1 }],
        stock: 3,
        status: "active",
        visibility: "visible",
        createdAt: "",
        updatedAt: ""
      }
    ]
  })
}));

import ShopPage from "@/app/[lang]/shop/page";

describe("shop page", () => {
  it("renders a dedicated collections section when collections are available", async () => {
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByRole("link", { name: /Skin Care Set/i })).toHaveAttribute("href", "/en/collections/skin-care-set");
    expect(screen.getByRole("link", { name: "All collections" })).toHaveAttribute("href", "/en/collections");
  });
});
