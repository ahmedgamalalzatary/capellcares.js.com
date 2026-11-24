import { describe, expect, it } from "vitest";
import type { Product } from "@capella/shared";
import { pickCategoryRowProducts } from "@/lib/shop-category-section";

describe("pickCategoryRowProducts", () => {
  it("takes the first 12 displayable products in the category's Featured order", () => {
    const products = [
      { id: 21, variants: [] },
      ...Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        variants: [{ price: 20 }]
      }))
    ] as Product[];

    expect(pickCategoryRowProducts(products).map((product) => product.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
    ]);
  });
});
