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
        viewAllCollections: "All collections",
        categories: "Categories"
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
      },
      { id: 21, parentId: null, slug: "body", name: { ar: "الجسم", en: "Body" }, enShopImagePath: "/uploads/body-en.jpg", arShopImagePath: "/uploads/body-ar.jpg", hasProducts: true, isLeaf: false },
      { id: 22, parentId: null, slug: "hair", name: { ar: "الشعر", en: "Hair" }, arShopImagePath: "/uploads/hair-ar.jpg", hasProducts: true, isLeaf: false },
      { id: 23, parentId: null, slug: "face", name: { ar: "الوجه", en: "Face" }, hasProducts: true, isLeaf: false },
      { id: 24, parentId: 21, slug: "oils", name: { ar: "زيوت", en: "Oils" }, enShopImagePath: "/uploads/oils.jpg", hasProducts: true, isLeaf: true },
      { id: 25, parentId: null, slug: "empty", name: { ar: "فارغ", en: "Empty" }, enShopImagePath: "/uploads/empty.jpg", hasProducts: false, isLeaf: true }
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
import { useCardSliderScreen } from "../helpers/media-query";

describe("shop page", () => {
  it("keeps its cards free of the image swipe, so a sideways swipe scrolls the row", async () => {
    useCardSliderScreen();
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getAllByRole("link", { name: "Summer Offer" }).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("card-image-carousel")).toBeNull();
  });

  it("renders the collections section on the shop landing page", async () => {
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByRole("heading", { name: "Collections" })).toBeInTheDocument();
    // The collection card links to its detail page from both the image and the heading.
    const collectionLinks = screen.getAllByRole("link", { name: /Skin Care Set/i });
    expect(collectionLinks.length).toBeGreaterThan(0);
    collectionLinks.forEach((link) => expect(link).toHaveAttribute("href", "/en/collections/skin-care-set"));
    expect(screen.getByRole("link", { name: "All collections" })).toBeInTheDocument();
  });

  it("names each bundle's category on its shop-row card", async () => {
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));

    // The collection is classified under "Sets" (category 11); the offer fixture carries no category, so its card shows no classification line.
    expect(screen.getByText("Sets")).toBeInTheDocument();
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

  it("prioritizes only the first shop media section's visible image", async () => {
    const { container } = render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
    const mediaImages = container.querySelectorAll('[data-viewport="desktop"] [data-slide] img');

    expect(mediaImages).toHaveLength(5);
    expect(mediaImages[0]).toHaveAttribute("data-priority", "true");
    for (const image of Array.from(mediaImages).slice(1)) {
      expect(image).toHaveAttribute("data-priority", "false");
    }
  });

  it("shows main categories with a picture in a Categories row between the first picture section and offers", async () => {
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));

    const row = screen.getByRole("region", { name: "Categories" });
    const links = Array.from(row.querySelectorAll("a"));
    // Body has its English picture; Hair falls back to its Arabic one; Face (no picture), Oils (sub-category) and Empty (no products) stay out.
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/en/category/body?categoryId=21", "/en/category/hair?categoryId=22"]);
    expect(links.map((link) => link.querySelector("img")?.getAttribute("src"))).toEqual([
      expect.stringContaining("body-en.jpg"),
      expect.stringContaining("hair-ar.jpg")
    ]);
    expect(row).toHaveTextContent("Body");

    const offers = screen.getByRole("heading", { name: "Offers" });
    expect(row.compareDocumentPosition(offers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
