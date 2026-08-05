import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ add: vi.fn(), lines: [], count: 0, setQty: vi.fn(), remove: vi.fn(), clear: vi.fn(), keyOf: vi.fn() })
}));

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has: () => false, toggle: vi.fn(), ids: [] })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

vi.mock("@capella/shared", async () => {
  const actual = await vi.importActual<any>("@capella/shared");
  return {
    ...actual,
    getDict: () => ({
      nav: {
        bestsellers: "Bestseller"
      },
      shop: {
        eyebrow: "Shop",
        heading: "Capella Shop",
        description: "Description",
        newProducts: "New",
        bestsellers: "Best Seller",
        featuredHeading: "Products",
        viewAllOffers: "All offers",
        viewAllProducts: "All products",
        collectionsEyebrow: "Collections",
        viewAllCollections: "All collections"
      },
      common: { save: "Save" },
      offers: { title: "Offers", badge: "Offer", save: "Save {amount}" },
      collections: { title: "Collections", badge: "Collection" },
      shopMedia: {
        sectionLabel: "Featured media"
      }
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
    products: [
      {
        id: 1,
        slug: "new-product",
        name: { ar: "جديد", en: "New Product" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/new.jpg",
        price: 100,
        categoryId: 1,
        variants: [],
        stock: 5,
        isNew: true,
        isBestseller: false,
        status: "active",
        createdAt: "",
        updatedAt: ""
      },
      {
        id: 2,
        slug: "best-product",
        name: { ar: "الأفضل", en: "Best Product" },
        description: { ar: "وصف", en: "Description" },
        imagePath: "/uploads/best.jpg",
        price: 120,
        categoryId: 1,
        variants: [],
        stock: 4,
        isNew: false,
        isBestseller: true,
        status: "active",
        createdAt: "",
        updatedAt: ""
      }
    ],
    offers: [
      {
        id: 1,
        slug: "summer-offer",
        name: { ar: "عرض", en: "Summer Offer" },
        description: { ar: "وصف", en: "Offer description" },
        imagePath: "/uploads/offer.jpg",
        price: 180,
        originalTotal: 240,
        items: [],
        stock: 5,
        status: "active",
        createdAt: "",
        updatedAt: ""
      }
    ],
    categories: [
      {
        id: 1,
        slug: "skin-care",
        name: { ar: "العناية", en: "Skin Care" },
        imagePath: "/uploads/category.jpg",
        createdAt: "",
        updatedAt: ""
      },
      {
        id: 11,
        slug: "sets",
        name: { ar: "مجموعات", en: "Sets" },
        imagePath: "/uploads/sets.jpg",
        createdAt: "",
        updatedAt: ""
      }
    ],
    advices: [],
    shopMediaSections: [
      {
        id: 10,
        slot: 1,
        status: "active",
        items: [
          {
            id: 20,
            arImagePath: null,
            arMobileImagePath: null,
            enImagePath: "http://localhost:4000/uploads/section-1.jpg",
            enMobileImagePath: "http://localhost:4000/uploads/section-1-mobile.jpg",
            targetType: "offers",
            targetId: null,
            href: "/en/offers",
            sortOrder: 1
          }
        ]
      },
      {
        id: 11,
        slot: 2,
        status: "active",
        items: [
          {
            id: 21,
            arImagePath: null,
            arMobileImagePath: null,
            enImagePath: "http://localhost:4000/uploads/section-2.jpg",
            enMobileImagePath: "http://localhost:4000/uploads/section-2-mobile.jpg",
            targetType: "new",
            targetId: null,
            href: "/en/new",
            sortOrder: 1
          }
        ]
      },
      {
        id: 12,
        slot: 3,
        status: "active",
        items: [
          {
            id: 22,
            arImagePath: null,
            arMobileImagePath: null,
            enImagePath: "http://localhost:4000/uploads/section-3.jpg",
            enMobileImagePath: "http://localhost:4000/uploads/section-3-mobile.jpg",
            targetType: "bestsellers",
            targetId: null,
            href: "/en/bestsellers",
            sortOrder: 1
          }
        ]
      },
      {
        id: 13,
        slot: 4,
        status: "active",
        items: [
          {
            id: 23,
            arImagePath: null,
            arMobileImagePath: null,
            enImagePath: "http://localhost:4000/uploads/section-4.jpg",
            enMobileImagePath: "http://localhost:4000/uploads/section-4-mobile.jpg",
            targetType: "products",
            targetId: null,
            href: "/en/products",
            sortOrder: 1
          }
        ]
      },
      {
        id: 14,
        slot: 5,
        status: "active",
        items: [
          {
            id: 24,
            arImagePath: null,
            arMobileImagePath: null,
            enImagePath: "http://localhost:4000/uploads/section-5.jpg",
            enMobileImagePath: "http://localhost:4000/uploads/section-5-mobile.jpg",
            targetType: "collections",
            targetId: null,
            href: "/en/collections",
            sortOrder: 1
          }
        ]
      }
    ],
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
  it("renders the collections section on the shop landing page", async () => {
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByRole("heading", { name: "Collections" })).toBeInTheDocument();
    // The collection card links to its detail page from both the image and the heading.
    const collectionLinks = screen.getAllByRole("link", { name: /Skin Care Set/i });
    expect(collectionLinks.length).toBeGreaterThan(0);
    collectionLinks.forEach((link) => expect(link).toHaveAttribute("href", "/en/collections/skin-care-set"));
    expect(screen.getByRole("link", { name: "All collections" })).toBeInTheDocument();
  });

  it("renders the configured shop media, product, collection, and advice sections", async () => {
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));

    const mediaLinks = screen.getAllByRole("link", { name: "Featured media 1" });
    const mediaHrefs = mediaLinks.map((link) => link.getAttribute("href"));

    expect(mediaHrefs).toEqual(expect.arrayContaining([
      "/en/offers",
      "/en/new",
      "/en/bestsellers",
      "/en/products",
      "/en/collections"
    ]));
    expect(mediaLinks[0]?.querySelector("img")).toHaveAttribute("src", "http://localhost:4000/uploads/section-1.jpg");
    expect(screen.getByRole("heading", { name: "Offers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collections" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Best Seller" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New" })).toBeInTheDocument();
    expect(screen.getByText("Advice")).toBeInTheDocument();
  });
});
