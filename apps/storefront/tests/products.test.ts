import { afterEach, describe, expect, it, vi } from "vitest";
import { firstInStockVariant, getProductBySlug, productPrice, resolveVariant, selectBestSellers, selectNewArrivals, type StorefrontProduct } from "@/lib/products";

afterEach(() => vi.unstubAllGlobals());

function makeProduct(overrides: Partial<StorefrontProduct> & { id: number }): StorefrontProduct {
  return {
    slug: `p-${overrides.id}`,
    name: { ar: `منتج ${overrides.id}`, en: `Product ${overrides.id}` },
    keywords: ["Natural Leather"],
    imagePath: `/uploads/p-${overrides.id}.png`,
    hoverImagePath: `/uploads/p-${overrides.id}-alt.png`,
    media: [],
    status: "active",
    isNew: true,
    isBestseller: false,
    sizes: [{ id: 1, label: "100ml", sortOrder: 1 }],
    colors: [],
    variants: [{ id: 1, sizeId: 1, colorId: null, price: 1690, stock: 5 }],
    ...overrides
  };
}

describe("productPrice", () => {
  it("returns the lowest-priced variant", () => {
    const product = makeProduct({
      id: 1,
      variants: [
        { id: 1, sizeId: 1, colorId: null, price: 1990, stock: 3 },
        { id: 2, sizeId: 1, colorId: null, price: 1690, stock: 2 }
      ]
    });
    expect(productPrice(product)).toBe(1690);
  });

  it("returns 0 when there are no variants", () => {
    expect(productPrice(makeProduct({ id: 2, variants: [] }))).toBe(0);
  });
});

describe("variant selection", () => {
  it("resolves the exact size and color to the sellable variant id", () => {
    const product = makeProduct({
      id: 8,
      sizes: [{ id: 1, label: "100ml", sortOrder: 1 }],
      colors: [{ id: 2, hex: "#FFFFFF", sortOrder: 1 }],
      variants: [{ id: 30, sizeId: 1, colorId: 2, price: 100, stock: 4 }]
    } as never);

    expect(resolveVariant(product, 1, 2)?.id).toBe(30);
  });

  it("chooses the first in-stock combination by default", () => {
    const product = makeProduct({
      id: 9,
      variants: [
        { id: 1, sizeId: 1, colorId: null, price: 100, stock: 0 },
        { id: 2, sizeId: 1, colorId: null, price: 100, stock: 3 }
      ]
    });
    expect(firstInStockVariant(product)?.id).toBe(2);
  });
});

describe("product detail", () => {
  it("loads the product selected by the shop query", async () => {
    const detail = makeProduct({ id: 12, slug: "matrix-product" });
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => detail }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getProductBySlug("matrix-product");

    expect(result).toEqual(detail);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/products/matrix-product"), { cache: "no-store" });
  });
});

describe("selectNewArrivals", () => {
  it("keeps only active products flagged isNew that have an image and a price", () => {
    const products = [
      makeProduct({ id: 1 }),
      makeProduct({ id: 2, isNew: false }),
      makeProduct({ id: 3, status: "inactive" }),
      makeProduct({ id: 4, imagePath: "" }),
      makeProduct({ id: 5, variants: [] })
    ];

    expect(selectNewArrivals(products).map((product) => product.id)).toEqual([1]);
  });
});

describe("selectBestSellers", () => {
  it("keeps only active products flagged isBestseller that have an image and a price", () => {
    const products = [
      makeProduct({ id: 1, isNew: false, isBestseller: true }),
      makeProduct({ id: 2, isBestseller: false }),
      makeProduct({ id: 3, isBestseller: true, status: "inactive" }),
      makeProduct({ id: 4, isBestseller: true, imagePath: "" }),
      makeProduct({ id: 5, isBestseller: true, variants: [] })
    ];

    expect(selectBestSellers(products).map((product) => product.id)).toEqual([1]);
  });
});
