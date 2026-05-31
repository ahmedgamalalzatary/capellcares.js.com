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
      common: { breadcrumbHome: "Home", buyNow: "Buy now", save: "Save" },
      collections: {
        title: "Collections",
        listEmpty: "No collections",
        badge: "Collection",
        collectionEyebrow: "Curated set",
        categoryLabel: "Category",
        itemsLabel: "Items",
        related: "Related collections",
        added: "Added",
        addCollectionToCart: "Add collection"
      }
    })
  };
});

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: ({ items }: any) => createElement("nav", null, items.map((item: any) => item.label).join(" / "))
}));

vi.mock("@/components/collections/collection-detail", () => ({
  CollectionDetail: ({ collection }: any) => createElement("div", { "data-testid": "collection-detail" }, collection.name.en)
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

vi.mock("@/lib/storefront-detail-page", () => ({
  resolveStorefrontSlugPageContext: async () => ({
    lang: "en",
    slug: "skin-care-set",
    dict: {
      common: { breadcrumbHome: "Home", buyNow: "Buy now", save: "Save" },
      collections: { title: "Collections" }
    }
  }),
  requireStorefrontValue: (value: any) => value,
  StorefrontJsonLd: () => createElement("div", { "data-testid": "json-ld" })
}));

vi.mock("@/lib/api/client", () => ({
  fetchCollections: vi.fn(async () => ([
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
  ])),
  fetchCollectionBySlug: vi.fn(async () => ({
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
  })),
  fetchCollectionDetailBySlug: vi.fn(async () => ({
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
    relatedItems: [],
    createdAt: "",
    updatedAt: ""
  })),
  fetchProducts: vi.fn(async () => ([
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
    },
    {
      id: 11,
      sku: "P11",
      slug: "serum",
      name: { ar: "سيروم", en: "Serum" },
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
      variants: [{ id: 102, productId: 11, size: "30ml", price: 140, stock: 4, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    }
  ])),
  fetchCategories: vi.fn(async () => ([
    { id: 11, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: true }
  ]))
}));

import CollectionsPage from "@/app/[lang]/collections/page";
import CollectionDetailPage from "@/app/[lang]/collections/[slug]/page";

describe("collection storefront pages", () => {
  it("renders the collections listing page", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByRole("link", { name: /Skin Care Set/i })).toHaveAttribute("href", "/en/collections/skin-care-set");
    expect(screen.getByText("Collections")).toBeInTheDocument();
  });

  it("renders the collection detail page", async () => {
    render(await CollectionDetailPage({ params: Promise.resolve({ lang: "en", slug: "skin-care-set" }) }));

    expect(screen.getByTestId("collection-detail")).toHaveTextContent("Skin Care Set");
    expect(screen.getByText(/Home/)).toBeInTheDocument();
  });
});
