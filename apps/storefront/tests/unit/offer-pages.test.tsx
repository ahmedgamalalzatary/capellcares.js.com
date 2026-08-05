import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: ({ items }: any) => createElement("nav", null, items.map((item: any) => item.label).join(" / "))
}));

vi.mock("@/components/offers/offer-detail", () => ({
  OfferDetail: ({ offer, category }: any) =>
    createElement(
      "div",
      { "data-testid": "offer-detail" },
      createElement("span", null, offer.name.en),
      createElement("span", { "data-testid": "offer-category" }, category ? category.name.en : "no-category")
    )
}));

vi.mock("@/lib/storefront-detail-page", () => ({
  resolveStorefrontSlugPageContext: async () => ({
    lang: "en",
    slug: "glow-bundle",
    dict: {
      common: { breadcrumbHome: "Home" },
      offers: { title: "Offers" }
    }
  }),
  requireStorefrontValue: (value: any) => value,
  StorefrontJsonLd: () => createElement("div", { "data-testid": "json-ld" })
}));

const { fetchOfferBySlug, fetchOfferDetailBySlug, fetchOffers, fetchProducts, fetchCategories } = vi.hoisted(() => {
  const offer = {
    id: 1,
    slug: "glow-bundle",
    name: { ar: "باقة", en: "Glow Bundle" },
    description: { ar: "وصف", en: "Glow set" },
    imagePath: "/uploads/offer.jpg",
    price: 150,
    originalTotal: 200,
    categoryId: 11,
    items: [{ variantId: 101, qty: 1 }],
    stock: 3,
    status: "active",
    visibility: "visible",
    relatedItems: [],
    createdAt: "",
    updatedAt: ""
  };

  return {
    fetchOfferBySlug: vi.fn(async () => offer),
    fetchOfferDetailBySlug: vi.fn(async () => offer),
    fetchOffers: vi.fn(async () => [offer]),
    fetchProducts: vi.fn(async () => [
      {
        id: 10,
        sku: "P10",
        slug: "cleanser",
        name: { ar: "غسول", en: "Cleanser" },
        description: { ar: "", en: "" },
        ingredients: { ar: "", en: "" },
        howToUse: { ar: "", en: "" },
        warnings: { ar: "", en: "" },
        keywords: [],
        buyingPrice: 10,
        imagePath: "",
        media: [],
        status: "active",
        isNew: false,
        isBestseller: false,
        categoryId: 11,
        variants: [{ id: 101, productId: 10, size: "100ml", price: 120, stock: 5, sortOrder: 1 }],
        createdAt: "",
        updatedAt: ""
      }
    ]),
    fetchCategories: vi.fn(async () => [
      { id: 11, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false }
    ])
  };
});

vi.mock("@/lib/api/client", () => ({
  fetchOfferBySlug,
  fetchOfferDetailBySlug,
  fetchOffers,
  fetchProducts,
  fetchCategories
}));

import OfferDetailPage from "@/app/[lang]/offers/[slug]/page";

describe("offer detail page category loading", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("still renders the offer when categories fail to load", async () => {
    fetchCategories.mockRejectedValueOnce(new Error("offline"));

    render(await OfferDetailPage({ params: Promise.resolve({ lang: "en", slug: "glow-bundle" }) }));

    expect(screen.getByTestId("offer-detail")).toHaveTextContent("Glow Bundle");
    expect(screen.getByTestId("offer-category")).toHaveTextContent("no-category");
  });

  it("does not label the offer with a soft-deleted category", async () => {
    fetchCategories.mockResolvedValueOnce([
      {
        id: 11,
        parentId: null,
        slug: "skin-care",
        name: { ar: "العناية بالبشرة", en: "Skin Care" },
        isLeaf: false,
        deletedAt: "2026-01-01T00:00:00.000Z"
      }
    ] as any);

    render(await OfferDetailPage({ params: Promise.resolve({ lang: "en", slug: "glow-bundle" }) }));

    expect(screen.getByTestId("offer-category")).toHaveTextContent("no-category");
  });

  it("labels the offer with its category when it loads", async () => {
    render(await OfferDetailPage({ params: Promise.resolve({ lang: "en", slug: "glow-bundle" }) }));

    expect(screen.getByTestId("offer-category")).toHaveTextContent("Skin Care");
  });
});
