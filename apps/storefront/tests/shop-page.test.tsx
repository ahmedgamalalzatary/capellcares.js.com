import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/shop",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("@/lib/categories", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/categories")>()),
  getCategories: vi.fn(async () => [
    { id: 1, parentId: null, slug: "women", sortOrder: 1, name: { ar: "نساء", en: "Women" }, imagePath: null, isLeaf: false, deletedAt: null },
    { id: 2, parentId: 1, slug: "slides", sortOrder: 1, name: { ar: "شباشب", en: "Slides" }, imagePath: "/uploads/slides.png", isLeaf: true, deletedAt: null },
    { id: 3, parentId: 1, slug: "socks", sortOrder: 2, name: { ar: "جوارب", en: "Socks" }, imagePath: "/uploads/socks.png", isLeaf: true, deletedAt: null }
  ])
}));

vi.mock("@/lib/homepage-banners", () => ({
  getHomepageBanners: vi.fn(async () => ({
    sections: {
      hero_primary: {
        key: "hero_primary",
        behavior: "carousel",
        items: [
          { id: 1, imagePath: "/uploads/hero-1.png", href: "/products/p1" },
          { id: 2, imagePath: "/uploads/hero-2.png", href: "/products/p2" }
        ]
      },
      grid_featured: {
        key: "grid_featured",
        behavior: "manual-grid",
        items: Array.from({ length: 5 }, (_, index) => ({
          id: index + 10,
          imagePath: `/uploads/grid-${index + 1}.png`,
          href: `/offers/${index + 1}`
        }))
      },
      single_mid: {
        key: "single_mid",
        behavior: "single-image",
        items: [{ id: 20, imagePath: "/uploads/single-1.png", href: "/collections/1" }]
      },
      hero_secondary: {
        key: "hero_secondary",
        behavior: "carousel",
        items: [{ id: 30, imagePath: "/uploads/hero-3.png", href: "/products/p3" }]
      },
      single_footer: {
        key: "single_footer",
        behavior: "single-image",
        items: [{ id: 40, imagePath: "/uploads/single-2.png", href: "/collections/2" }]
      }
    }
  }))
}));

vi.mock("@/lib/products", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/products")>()),
  getNewArrivals: vi.fn(async () => []),
  getBestSellers: vi.fn(async () => []),
  getProductBySlug: vi.fn(async (slug: string) => slug === "matrix-product" ? ({
    id: 7, slug, name: { ar: "منتج", en: "Matrix product" }, keywords: [],
    imagePath: "/uploads/product.png", media: [], status: "active", isNew: false, isBestseller: false,
    sizes: [{ id: 1, label: "100ml", sortOrder: 1 }],
    colors: [{ id: 10, hex: "#FFFFFF", sortOrder: 1 }],
    variants: [{ id: 101, sizeId: 1, colorId: 10, price: 20, stock: 2 }]
  }) : null)
}));

import ShopPage from "@/app/[lang]/shop/page";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";

afterEach(() => {
  cleanup();
});

async function renderShop() {
  return render(<LocaleProvider lang="en">{await ShopPage({ searchParams: Promise.resolve({}) })}</LocaleProvider>);
}

describe("HomePage homepage sections", () => {
  it("renders carousel, four-up grid, and single-image sections", async () => {
    await renderShop();

    expect(screen.getByRole("region", { name: "Homepage hero primary" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage featured grid" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage single middle" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage hero secondary" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Homepage single footer" })).toBeInTheDocument();
    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(8);
  });

  it("renders the shop-by-category strip from depth-1 categories with images", async () => {
    await renderShop();

    expect(screen.getByRole("region", { name: /shop by category/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /slides/i })).toHaveAttribute("href", "/en/shop?category=slides");
    expect(screen.getByRole("link", { name: /socks/i })).toHaveAttribute("href", "/en/shop?category=socks");
  });

  it("advances the hero carousel one image at a time", async () => {
    await renderShop();

    fireEvent.click(screen.getByRole("button", { name: "Homepage hero primary next" }));
    expect(screen.getByRole("img", { name: "Homepage hero primary image 2" })).toBeInTheDocument();
  });

  it("slides the featured grid one card per step instead of paging by four", async () => {
    await renderShop();

    const track = screen.getByTestId("Homepage featured grid track");
    expect(track.style.transform).toBe("translateX(-0%)");

    fireEvent.click(screen.getByRole("button", { name: "Homepage featured grid next" }));
    expect(track.style.transform).toBe("translateX(-25%)");

    // Five items with a four-wide window: only one step exists, so it clamps.
    fireEvent.click(screen.getByRole("button", { name: "Homepage featured grid next" }));
    expect(track.style.transform).toBe("translateX(-25%)");
  });

  it("consumes product option query parameters in a real selection view", async () => {
    render(<LocaleProvider lang="en">{await ShopPage({
      searchParams: Promise.resolve({ product: "matrix-product", size: "1", color: "10", variant: "101" })
    })}</LocaleProvider>);

    expect(screen.getByRole("region", { name: "Matrix product" })).toBeInTheDocument();
    expect(screen.getByText("20 EGP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color #FFFFFF" })).toBeInTheDocument();
  });
});
