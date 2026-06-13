import { describe, expect, it } from "vitest";
import type { Collection, Offer, Product } from "@capella/shared";

import { buildHeaderMenu, compareHeaderCategoryEntries } from "@/lib/header-menu";
import type { NavGroup } from "@/lib/nav";

const navGroups: NavGroup[] = [
  {
    root: { id: 10, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false },
    children: []
  },
  {
    root: { id: 11, parentId: null, slug: "body-care", name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: false },
    children: []
  }
];

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 1,
    sku: "sku-1",
    slug: "product-1",
    name: { ar: "منتج", en: "Product" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 100,
    imagePath: "/product.jpg",
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 10,
    variants: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function makeOffer(overrides: Partial<Offer>): Offer {
  return {
    id: 1,
    slug: "offer-1",
    name: { ar: "عرض", en: "Offer" },
    description: { ar: "", en: "" },
    imagePath: "/offer.jpg",
    price: 50,
    originalTotal: 100,
    items: [],
    stock: 5,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function makeCollection(overrides: Partial<Collection>): Collection {
  return {
    id: 1,
    slug: "collection-1",
    name: { ar: "مجموعة", en: "Collection" },
    description: { ar: "", en: "" },
    imagePath: "/collection.jpg",
    price: 80,
    originalTotal: 120,
    categoryId: 10,
    items: [],
    stock: 5,
    status: "active",
    visibility: "visible",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const dict = {
  nav: {
    new: "New",
    bestsellers: "Best Seller",
    offers: "Offers",
    collections: "Collections"
  }
};

describe("buildHeaderMenu", () => {
  it("orders entries as New, Bestsellers, Offers, categories, Collections", () => {
    const menu = buildHeaderMenu({
      navGroups,
      products: [
        makeProduct({ id: 1, slug: "new-product", isNew: true }),
        makeProduct({ id: 2, slug: "best-product", isBestseller: true }),
        makeProduct({ id: 3, slug: "plain-product" })
      ],
      offers: [makeOffer({ id: 7, slug: "bundle" })],
      collections: [makeCollection({ id: 9, slug: "starter" })],
      dict,
      lang: "en"
    });

    expect(menu.map((entry) => entry.label)).toEqual([
      "New",
      "Best Seller",
      "Offers",
      "Skin Care",
      "Body Care",
      "Collections"
    ]);
    expect(menu[0]).toMatchObject({
      type: "products",
      slug: "new",
      products: [{ slug: "new-product", name: { ar: "منتج", en: "Product" }, imagePath: "/product.jpg" }]
    });
    expect(menu[1]).toMatchObject({
      type: "products",
      slug: "bestsellers",
      products: [{ slug: "best-product" }]
    });
    expect(menu[2]).toMatchObject({
      type: "offers",
      slug: "offers",
      offers: [{ slug: "bundle", label: "Offer", name: { ar: "عرض", en: "Offer" }, imagePath: "/offer.jpg" }]
    });
    expect(menu[5]).toMatchObject({
      type: "collections",
      slug: "collections",
      collections: [{ slug: "starter", label: "Collection", imagePath: "/collection.jpg" }]
    });
  });

  it("excludes inactive/deleted offers and hidden/inactive collections", () => {
    const menu = buildHeaderMenu({
      navGroups: [],
      products: [],
      offers: [
        makeOffer({ id: 1, slug: "live" }),
        makeOffer({ id: 2, slug: "off", status: "inactive" }),
        makeOffer({ id: 3, slug: "gone", deletedAt: "2026-02-01T00:00:00.000Z" })
      ],
      collections: [
        makeCollection({ id: 1, slug: "live-col" }),
        makeCollection({ id: 2, slug: "hidden-col", visibility: "hidden" }),
        makeCollection({ id: 3, slug: "off-col", status: "inactive" })
      ],
      dict,
      lang: "en"
    });

    const offersEntry = menu.find((entry) => entry.type === "offers");
    const collectionsEntry = menu.find((entry) => entry.type === "collections");
    expect(offersEntry?.type === "offers" && offersEntry.offers.map((o) => o.slug)).toEqual(["live"]);
    expect(
      collectionsEntry?.type === "collections" && collectionsEntry.collections.map((c) => c.slug)
    ).toEqual(["live-col"]);
  });
});

describe("compareHeaderCategoryEntries", () => {
  it("orders unranked category roots oldest-first, mirroring the ERP tree", () => {
    const entries = [
      { type: "category" as const, key: "c-7", id: 7, slug: "hair", label: "Hair", createdAt: "2026-06-12T09:00:00.000Z", children: [] },
      { type: "category" as const, key: "c-8", id: 8, slug: "fragrance", label: "Fragrance", createdAt: "2026-06-10T09:00:00.000Z", children: [] }
    ];

    const ordered = entries.slice().sort(compareHeaderCategoryEntries);

    expect(ordered.map((entry) => entry.id)).toEqual([8, 7]);
  });
});
