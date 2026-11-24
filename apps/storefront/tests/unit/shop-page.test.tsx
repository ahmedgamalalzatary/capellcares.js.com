import { cleanup, render, screen, within } from "@testing-library/react";
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
      nav: {
        bestsellers: "Bestseller"
      },
      shop: {
        byGender: "Shop by gender",
        byCategory: "Categories",
        byBrand: "Brands",
        viewAll: "View all",
        bestsellers: "Bestseller",
        newProducts: "New arrivals"
      },
      offers: { title: "Offers" },
      collections: { title: "Sets" },
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

// The cards themselves are tested on their own; here each one only needs to show which product or offer it is.
vi.mock("@/components/products/product-card", () => ({
  ProductCard: ({ product }: any) => createElement("article", null, product.name.en)
}));

vi.mock("@/components/shop/section-card", () => ({
  SectionCard: ({ data }: any) => createElement("article", null, data.name.en)
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

function mediaSection(id: number, image: string) {
  return {
    id,
    status: "active",
    items: [
      {
        id: id * 10,
        arImagePath: null,
        arMobileImagePath: null,
        enImagePath: `http://localhost:4000/uploads/${image}.jpg`,
        enMobileImagePath: `http://localhost:4000/uploads/${image}-mobile.jpg`,
        targetType: "offers",
        targetId: null,
        sortOrder: 1
      }
    ]
  };
}

function product(id: number, name: string, categoryId: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: name.toLowerCase().replace(/ /g, "-"),
    name: { ar: name, en: name },
    categoryId,
    status: "active",
    isNew: false,
    isBestseller: false,
    createdAt: `2026-01-${String(id).padStart(2, "0")}T00:00:00Z`,
    variants: [{ price: 20 }],
    ...extra
  };
}

type Block = { id: number; type: string; categoryId: number | null; mediaSection: ReturnType<typeof mediaSection> | null; sortOrder: number };
const builtIn = (id: number, type: string): Block => ({ id, type, categoryId: null, mediaSection: null, sortOrder: id });
const categoryBlock = (id: number, categoryId: number): Block => ({ id, type: "category", categoryId, mediaSection: null, sortOrder: id });
const mediaBlock = (id: number, section: ReturnType<typeof mediaSection>): Block => ({ id, type: "media", categoryId: null, mediaSection: section, sortOrder: id });

/** Today's Falta page: banner, genders, categories, bestsellers, the category and picture sections, new, offers, brands. */
const DEFAULT_LAYOUT: Block[] = [
  mediaBlock(1, mediaSection(10, "top")),
  builtIn(2, "genders"),
  builtIn(3, "category_tiles"),
  builtIn(4, "bestsellers"),
  categoryBlock(5, 1),
  mediaBlock(6, mediaSection(11, "custom")),
  categoryBlock(7, 3),
  categoryBlock(8, 4),
  builtIn(9, "new"),
  builtIn(10, "offers"),
  builtIn(11, "brands")
];
const page = vi.hoisted(() => ({ layout: [] as unknown[] }));

vi.mock("@/lib/api/client", () => ({
  fetchCategories: async () => shopData().categories,
  fetchBrands: async () => shopData().brands,
  fetchGenders: async () => shopData().genders,
  fetchAdvices: async () => shopData().advices,
  fetchOffers: async () => shopData().offers,
  fetchCollections: async () => shopData().collections,
  fetchShopLayout: async () => page.layout,
  fetchProducts: async ({ category, categoryId }: { category?: string; categoryId?: string }) => {
    const { products } = shopData();
    if (category === "building" && categoryId === "1") {
      return products.filter((item) => item.categoryId === 1 || item.categoryId === 2).reverse();
    }
    if (category === "dolls" && categoryId === "4") {
      return products.filter((item) => item.categoryId === 4 && item.status === "active");
    }
    return category || categoryId ? [] : products;
  }
}));

function shopData() {
  return {
    categories: [
      { id: 1, parentId: null, slug: "building", name: { ar: "تركيب", en: "Building" }, imagePath: "/uploads/building.jpg", isLeaf: false, hasProducts: true },
      { id: 2, parentId: 1, slug: "bricks", name: { ar: "مكعبات", en: "Bricks" }, imagePath: "/uploads/bricks.jpg", isLeaf: true, hasProducts: true },
      { id: 3, parentId: null, slug: "empty", name: { ar: "فارغ", en: "Empty" }, imagePath: null, isLeaf: true, hasProducts: false },
      { id: 4, parentId: null, slug: "dolls", name: { ar: "عرائس", en: "Dolls" }, imagePath: null, isLeaf: true, hasProducts: true }
    ],
    brands: [
      { id: 1, slug: "lego", name: { ar: "ليجو", en: "Lego" }, imagePath: "/uploads/lego.png", hasProducts: true },
      { id: 2, slug: "unused", name: { ar: "غير مستخدم", en: "Unused brand" }, imagePath: null, hasProducts: false }
    ],
    genders: [
      { id: 1, slug: "boys", name: { ar: "أولاد", en: "Boys" }, imagePath: "/uploads/boys.png", arImagePath: "/uploads/boys-ar.png", hasProducts: true },
      { id: 2, slug: "baby", name: { ar: "بيبي", en: "Baby" }, imagePath: "/uploads/baby.png", hasProducts: false }
    ],
    advices: [],
    products: [
      product(1, "Brick Tower", 2, { isBestseller: true }),
      product(2, "Big Doll", 4, { isNew: true }),
      product(3, "Old Doll", 4, { status: "inactive", isNew: true }),
      product(4, "Starter Bricks", 1),
      product(5, "Unpriced Set", 1, { variants: [] })
    ],
    offers: [
      { id: 1, slug: "summer", name: { ar: "صيف", en: "Summer deal" }, status: "active", deletedAt: null, categoryId: null },
      { id: 2, slug: "gone", name: { ar: "قديم", en: "Gone deal" }, status: "inactive", deletedAt: null, categoryId: null }
    ],
    collections: [
      { id: 1, slug: "starter", name: { ar: "بداية", en: "Starter set" }, status: "active", visibility: "visible", deletedAt: null, categoryId: 4 },
      { id: 2, slug: "hidden", name: { ar: "مخفي", en: "Hidden set" }, status: "active", visibility: "hidden", deletedAt: null, categoryId: 4 }
    ]
  };
}

import ShopPage from "@/app/[lang]/shop/page";
import { GenderTiles } from "@/components/shop/shop-tiles";

async function renderShop() {
  return render(await ShopPage({ params: Promise.resolve({ lang: "en" }) }));
}

describe("shop page", () => {
  beforeEach(() => {
    page.layout = DEFAULT_LAYOUT;
  });

  it("shows the sections in the saved order, ending with Falta & Zoobi", async () => {
    const { container } = await renderShop();
    const order = Array.from(container.querySelectorAll("h2, [data-viewport]")).map((el) =>
      el.tagName === "H2" ? el.textContent : "image"
    );
    expect(order).toEqual([
      "image", "Categories", "Bestseller",
      "Building", "image", "Dolls",
      "New arrivals", "Offers", "Brands", "Advice"
    ]);
  });

  it("has no sets section until the ERP adds it, then shows the visible sets with a view all link", async () => {
    await renderShop();
    expect(screen.queryByRole("heading", { name: "Sets" })).toBeNull();
    cleanup();

    page.layout = [builtIn(1, "new"), builtIn(2, "collections")];
    await renderShop();
    const sets = screen.getByRole("heading", { name: "Sets" }).closest("section")!;
    expect(within(sets).getByText("Starter set")).toBeInTheDocument();
    expect(within(sets).queryByText("Hidden set")).toBeNull();
    expect(within(sets).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/en/collections");
  });

  it("follows a different saved order, and leaves out the sections that were removed", async () => {
    page.layout = [
      builtIn(1, "offers"),
      categoryBlock(2, 4),
      builtIn(3, "brands"),
      mediaBlock(4, mediaSection(12, "lower")),
      builtIn(5, "new")
    ];
    const { container } = await renderShop();
    const order = Array.from(container.querySelectorAll("h2, [data-viewport]")).map((el) =>
      el.tagName === "H2" ? el.textContent : "image"
    );
    expect(order).toEqual(["Offers", "Dolls", "Brands", "image", "New arrivals", "Advice"]);
    expect(screen.queryByRole("navigation", { name: "Shop by gender" })).toBeNull();
    expect(container.querySelector("#categories")).toBeNull();
  });

  it("loads the first picture section first, wherever it sits on the page", async () => {
    page.layout = [builtIn(1, "new"), mediaBlock(2, mediaSection(12, "first")), mediaBlock(3, mediaSection(13, "second"))];
    const { container } = await renderShop();
    const mediaImages = container.querySelectorAll('[data-viewport="desktop"] [data-slide] img');
    expect(mediaImages).toHaveLength(2);
    expect(mediaImages[0]).toHaveAttribute("data-priority", "true");
    expect(mediaImages[1]).toHaveAttribute("data-priority", "false");
  });

  it("shows category products and their descendants in the linked page's Featured order", async () => {
    await renderShop();
    const building = screen.getByRole("heading", { name: "Building" }).closest("section")!;
    expect(within(building).getAllByRole("article").map((card) => card.textContent)).toEqual([
      "Starter Bricks", "Brick Tower"
    ]);
    const dolls = screen.getByRole("heading", { name: "Dolls" }).closest("section")!;
    expect(within(dolls).getByText("Big Doll")).toBeInTheDocument();
    expect(within(dolls).queryByText("Old Doll")).toBeNull();
  });

  it("links each category section's view all to its category page", async () => {
    await renderShop();
    const building = screen.getByRole("heading", { name: "Building" }).closest("section")!;
    expect(within(building).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/en/category/building?categoryId=1");
  });

  it("fills bestsellers, new and offers, leaving out hidden items, each with a view all link", async () => {
    await renderShop();
    const section = (name: string) => screen.getByRole("heading", { name }).closest("section")!;
    expect(within(section("Bestseller")).getByText("Brick Tower")).toBeInTheDocument();
    expect(within(section("Bestseller")).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/en/bestsellers");
    expect(within(section("New arrivals")).getByText("Big Doll")).toBeInTheDocument();
    expect(within(section("New arrivals")).queryByText("Old Doll")).toBeNull();
    expect(within(section("New arrivals")).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/en/new");
    expect(within(section("Offers")).getByText("Summer deal")).toBeInTheDocument();
    expect(within(section("Offers")).queryByText("Gone deal")).toBeNull();
    expect(within(section("Offers")).getByRole("link", { name: "View all" })).toHaveAttribute("href", "/en/offers");
  });

  it("starts with the first image, then every gender, even one with no toys yet", async () => {
    const { container } = await renderShop();
    const section = screen.getByRole("navigation", { name: "Shop by gender" });
    expect(screen.getByRole("link", { name: "Boys" })).toHaveAttribute("href", "/en/genders/boys");
    expect(screen.getByRole("link", { name: "Baby" })).toHaveAttribute("href", "/en/genders/baby");
    const firstImage = container.querySelector("[data-viewport]")!;
    expect(section.compareDocumentPosition(firstImage) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("has no star mark beside the section headings", async () => {
    const { container } = await renderShop();
    expect(container.querySelector("h2 svg")).toBeNull();
  });

  it("links each main category that has products, and leaves out the rest", async () => {
    const { container } = await renderShop();
    const categories = container.querySelector("#categories") as HTMLElement;
    expect(within(categories).getByRole("link", { name: "Building" })).toHaveAttribute("href", "/en/category/building?categoryId=1");
    expect(within(categories).getByRole("link", { name: "Dolls" })).toBeInTheDocument();
    expect(within(categories).queryByRole("link", { name: "Bricks" })).toBeNull();
    expect(within(categories).queryByRole("link", { name: "Empty" })).toBeNull();
  });

  it("links brands that have products, and has no character section", async () => {
    const { container } = await renderShop();
    expect(screen.getByRole("link", { name: "Lego" })).toHaveAttribute("href", "/en/brands/lego");
    expect(screen.queryByRole("link", { name: "Unused brand" })).toBeNull();
    expect(container.querySelector('a[href*="/characters/"]')).toBeNull();
  });

  it("gives the footer's Category and Brands links a place to land", async () => {
    const { container } = await renderShop();
    expect(container.querySelector("#categories")).toHaveTextContent("Categories");
    expect(container.querySelector("#brands")).toHaveTextContent("Brands");
  });

  it("puts a view all link beside the categories and brands titles, leading to their all pages", async () => {
    const { container } = await renderShop();
    const inSection = (id: string) => Array.from(container.querySelectorAll(`#${id} a`)).find((a) => a.textContent === "View all");
    expect(inSection("categories")).toHaveAttribute("href", "/en/categories");
    expect(inSection("brands")).toHaveAttribute("href", "/en/brands");
  });

  it("shows the gender picture made for the page's language", () => {
    const genders = [
      { id: 1, slug: "boys", name: { ar: "أولاد", en: "Boys" }, imagePath: "/uploads/boys.png", arImagePath: "/uploads/boys-ar.png" },
      // Saved before Arabic pictures existed: it keeps showing its one picture.
      { id: 2, slug: "baby", name: { ar: "بيبي", en: "Baby" }, imagePath: "/uploads/baby.png", arImagePath: null }
    ];
    const src = (container: HTMLElement, href: string) => container.querySelector(`a[href="${href}"] img`)?.getAttribute("src");
    const arabic = render(<GenderTiles genders={genders} lang="ar" label="x" />);
    expect(src(arabic.container, "/ar/genders/boys")).toContain("boys-ar.png");
    expect(src(arabic.container, "/ar/genders/baby")).toContain("baby.png");
    arabic.unmount();
    const english = render(<GenderTiles genders={genders} lang="en" label="x" />);
    expect(src(english.container, "/en/genders/boys")).not.toContain("boys-ar");
  });

  it("prioritizes only the first image", async () => {
    const { container } = await renderShop();
    const mediaImages = container.querySelectorAll('[data-viewport="desktop"] [data-slide] img');
    expect(mediaImages).toHaveLength(2);
    expect(mediaImages[0]).toHaveAttribute("data-priority", "true");
    expect(mediaImages[1]).toHaveAttribute("data-priority", "false");
  });
});
