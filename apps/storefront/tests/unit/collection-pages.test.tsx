import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      brand: "Capella",
      common: {
        breadcrumbHome: "Home",
        buyNow: "Buy now",
        save: "Save",
        filters: "Filters",
        results: "{n} results",
        clear: "Clear",
        view: "View",
        addToCart: "Add to cart",
        added: "Added",
        addToWishlist: "Wishlist"
      },
      nav: { search: "Search", allCategories: "All categories" },
      filters: {
        sortBy: "Sort by",
        sortFeatured: "Featured",
        sortNewest: "Newest",
        sortPriceAsc: "Price: low to high",
        sortPriceDesc: "Price: high to low",
        sortName: "Name",
        title: "Filters",
        bytype: "Category",
        price: "Price",
        priceMin: "Min",
        priceMax: "Max",
        to: "to",
        toggleCategory: "Toggle category",
        showResults: "Show results",
        closeFilters: "Close filters"
      },
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
vi.mock("@/components/reviews/reviews-section", () => ({
  ReviewsSection: () => createElement("section", { "data-testid": "reviews-section" })
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

const {
  fetchCollections,
  fetchCollectionBySlug,
  fetchCollectionDetailBySlug,
  fetchProducts,
  fetchCategories
} = vi.hoisted(() => ({
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
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: ""
      },
      {
        id: 2,
        slug: "body-lotion-set",
        name: { ar: "مجموعة لوشن", en: "Body Lotion Set" },
        description: { ar: "وصف", en: "Body routine" },
        imagePath: "/uploads/body.jpg",
        price: 120,
        originalTotal: 180,
        categoryId: 14,
        items: [{ variantId: 103, qty: 1 }, { variantId: 104, qty: 1 }],
        stock: 3,
        status: "active",
        visibility: "visible",
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: ""
      },
      {
        id: 3,
        slug: "hair-set",
        name: { ar: "مجموعة شعر", en: "Hair Set" },
        description: { ar: "وصف", en: "Hair routine" },
        imagePath: "/uploads/hair.jpg",
        price: 90,
        originalTotal: 130,
        categoryId: 13,
        items: [{ variantId: 105, qty: 1 }, { variantId: 106, qty: 1 }],
        stock: 3,
        status: "active",
        visibility: "visible",
        createdAt: "2024-03-01T00:00:00.000Z",
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
      { id: 11, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false },
      { id: 12, parentId: null, slug: "body-care", name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: false },
      { id: 13, parentId: null, slug: "hair-care", name: { ar: "العناية بالشعر", en: "Hair Care" }, isLeaf: false },
      { id: 14, parentId: 12, slug: "body-lotion", name: { ar: "لوشن الجسم", en: "Body Lotion" }, isLeaf: true },
      { id: 15, parentId: null, slug: "fragrance", name: { ar: "عطور", en: "Fragrance" }, isLeaf: false }
    ]))
}));

vi.mock("@/lib/api/client", () => ({
  fetchCollections,
  fetchCollectionBySlug,
  fetchCollectionDetailBySlug,
  fetchProducts,
  fetchCategories
}));

import CollectionsPage from "@/app/[lang]/collections/page";
import CollectionDetailPage from "@/app/[lang]/collections/[slug]/page";

describe("collection storefront pages", () => {
  beforeEach(() => {
    fetchCollections.mockClear();
    fetchCollectionBySlug.mockClear();
    fetchCollectionDetailBySlug.mockClear();
    fetchProducts.mockClear();
    fetchCategories.mockClear();
  });

  it("renders the collections listing page", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    const collectionLinks = screen.getAllByRole("link", { name: /Skin Care Set/i });
    expect(collectionLinks.length).toBeGreaterThan(0);
    collectionLinks.forEach((link) => expect(link).toHaveAttribute("href", "/en/collections/skin-care-set"));
    expect(screen.getByText("Collections")).toBeInTheDocument();
  });

  it("uses the global filter drawer with only a category filter and includes the shared sort control", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByRole("button", { name: /Filters/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort by" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Min")).not.toBeInTheDocument();
  });

  it("sorts collections with the shared sort options", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "price-asc" }
    });

    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Hair Set",
      "Body Lotion Set",
      "Skin Care Set"
    ]);
  });

  it("only lists big categories that contain collections, never leaf or empty ones", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    // Big categories that own collections appear...
    expect(screen.getByRole("radio", { name: "Body Care" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Hair Care" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Skin Care" })).toBeInTheDocument();
    // ...but leaf subcategories and empty big categories do not.
    expect(screen.queryByRole("radio", { name: "Body Lotion" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Fragrance" })).not.toBeInTheDocument();
  });

  it("filters collections by the selected big category, including descendants", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    fireEvent.click(screen.getByRole("radio", { name: "Body Care" }));

    // Body Lotion Set lives under Body Care via the leaf category, so it stays.
    expect(screen.getByRole("heading", { name: "Body Lotion Set" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hair Set" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Skin Care Set" })).not.toBeInTheDocument();
  });

  it("renders a pill-group of the big categories that own collections", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    const pillGroup = document.querySelector(".pill-group");
    expect(pillGroup).toBeInTheDocument();
    const pillLabels = Array.from(pillGroup!.querySelectorAll(".filter-pill")).map((pill) => pill.textContent);
    expect(pillLabels).toEqual(["Skin Care", "Body Care", "Hair Care"]);
  });

  it("toggles category pills as a descendant-aware multi-select over the grid", async () => {
    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    fireEvent.click(screen.getByRole("button", { name: /^Body Care/ }));
    expect(screen.getByRole("heading", { name: "Body Lotion Set" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hair Set" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Skin Care Set" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Hair Care/ }));
    expect(screen.getByRole("heading", { name: "Body Lotion Set" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hair Set" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Skin Care Set" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Body Care/ }));
    expect(screen.getByRole("heading", { name: "Hair Set" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Body Lotion Set" })).not.toBeInTheDocument();
  });

  it("renders collections when categories loading fails", async () => {
    fetchCategories.mockRejectedValueOnce(new Error("offline"));

    render(await CollectionsPage({ params: Promise.resolve({ lang: "en" }) }));

    expect(screen.getByRole("heading", { name: "Skin Care Set" })).toBeInTheDocument();
  });

  it("renders the collection detail page", async () => {
    render(await CollectionDetailPage({ params: Promise.resolve({ lang: "en", slug: "skin-care-set" }) }));

    expect(screen.getByTestId("collection-detail")).toHaveTextContent("Skin Care Set");
    expect(screen.getByText(/Home/)).toBeInTheDocument();
  });
});
