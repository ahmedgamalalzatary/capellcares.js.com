import { describe, expect, it } from "vitest";
import { productPrice, selectBestSellers, selectNewArrivals, type StorefrontProduct } from "@/lib/products";

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
    variants: [{ price: 1690, stock: 5 }],
    ...overrides
  };
}

describe("productPrice", () => {
  it("returns the lowest-priced variant", () => {
    const product = makeProduct({
      id: 1,
      variants: [
        { price: 1990, stock: 3 },
        { price: 1690, stock: 2 }
      ]
    });
    expect(productPrice(product)).toBe(1690);
  });

  it("returns 0 when there are no variants", () => {
    expect(productPrice(makeProduct({ id: 2, variants: [] }))).toBe(0);
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
