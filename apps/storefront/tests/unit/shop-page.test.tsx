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
        byGender: "Shop by gender",
        byCategory: "Shop by category"
      },
      common: { previous: "Previous", next: "Next" },
      shopMedia: {
        sectionLabel: "Featured media"
      }
    })
  };
});

vi.mock("@/components/products/advice-section", () => ({
  AdviceSection: () => createElement("h2", null, "Advice")
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

vi.mock("@/lib/storefront-static-data", () => ({
  loadShopPageData: async () => ({
    categories: [
      { id: 1, parentId: null, slug: "building", name: { ar: "تركيب", en: "Building" }, imagePath: "/uploads/building.jpg", isLeaf: false, hasProducts: true },
      { id: 2, parentId: 1, slug: "bricks", name: { ar: "مكعبات", en: "Bricks" }, imagePath: "/uploads/bricks.jpg", isLeaf: true, hasProducts: true },
      { id: 3, parentId: null, slug: "empty", name: { ar: "فارغ", en: "Empty" }, imagePath: null, isLeaf: true, hasProducts: false },
      { id: 4, parentId: null, slug: "dolls", name: { ar: "عرائس", en: "Dolls" }, imagePath: null, isLeaf: true, hasProducts: true }
    ],
    genders: [
      { id: 1, slug: "boys", name: { ar: "أولاد", en: "Boys" }, imagePath: "/uploads/boys.png", hasProducts: true },
      { id: 2, slug: "baby", name: { ar: "بيبي", en: "Baby" }, imagePath: "/uploads/baby.png", hasProducts: false }
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
    ]
  })
}));

import ShopPage from "@/app/[lang]/shop/page";

describe("shop page", () => {
  it("shows the sections in the agreed order, with an image before each", async () => {
    const { container } = render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
    const order = Array.from(container.querySelectorAll("h2, [data-viewport]")).map((el) =>
      el.tagName === "H2" ? el.textContent : "image"
    );
    expect(order).toEqual([
      "image", "Shop by category",
      "image",
      "image",
      "image", "Advice",
      "image"
    ]);
  });

  it("starts with every gender, above the first image, even one with no toys yet", async () => {
    const { container } = render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
    const section = screen.getByRole("navigation", { name: "Shop by gender" });
    expect(screen.getByRole("link", { name: "Boys" })).toHaveAttribute("href", "/en/genders/boys");
    expect(screen.getByRole("link", { name: "Baby" })).toHaveAttribute("href", "/en/genders/baby");
    const firstImage = container.querySelector("[data-viewport]")!;
    expect(section.compareDocumentPosition(firstImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has no star mark beside the section headings", async () => {
    const { container } = render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
    expect(container.querySelector("h2 svg")).toBeNull();
  });

  it("links each main category that has products, and leaves out the rest", async () => {
    render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
    expect(screen.getByRole("link", { name: "Building" })).toHaveAttribute("href", "/en/category/building?categoryId=1");
    expect(screen.getByRole("link", { name: "Dolls" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bricks" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Empty" })).toBeNull();
  });

  it("has no brand or character sections", async () => {
    const { container } = render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
    expect(container.querySelector('a[href*="/brands/"], a[href*="/characters/"]')).toBeNull();
  });

  it("prioritizes only the first image", async () => {
    const { container } = render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
    const mediaImages = container.querySelectorAll('[data-viewport="desktop"] [data-slide] img');
    expect(mediaImages).toHaveLength(5);
    expect(mediaImages[0]).toHaveAttribute("data-priority", "true");
    for (const image of Array.from(mediaImages).slice(1)) {
      expect(image).toHaveAttribute("data-priority", "false");
    }
  });
});
