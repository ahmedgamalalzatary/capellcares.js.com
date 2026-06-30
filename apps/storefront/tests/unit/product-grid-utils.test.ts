import { describe, expect, it } from "vitest";
import type { Product, ProductVariant } from "@capella/shared";
import { minVariantPrice } from "@/utils/product-grid.utils";

function makeVariant(overrides: Partial<ProductVariant>): ProductVariant {
  return {
    id: 1,
    productId: 1,
    size: "30ml",
    price: 200,
    stock: 5,
    ...overrides
  };
}

function makeProduct(variants: ProductVariant[]): Product {
  return {
    id: 1,
    sku: "SKU-1",
    slug: "product-1",
    name: { ar: "", en: "" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 100,
    imagePath: "/p.png",
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 1,
    variants,
    createdAt: "",
    updatedAt: ""
  };
}

describe("minVariantPrice", () => {
  it("returns the active discounted price, not the original list price", () => {
    const product = makeProduct([
      makeVariant({
        price: 200,
        discount: {
          type: "percentage",
          value: 50,
          startsAt: "2000-01-01T00:00:00.000Z",
          endsAt: "2999-01-01T00:00:00.000Z",
          status: "active"
        }
      })
    ]);

    expect(minVariantPrice(product)).toBe(100);
  });

  it("ignores an inactive discount and falls back to the list price", () => {
    const product = makeProduct([
      makeVariant({
        price: 200,
        discount: {
          type: "percentage",
          value: 50,
          startsAt: "2000-01-01T00:00:00.000Z",
          endsAt: "2999-01-01T00:00:00.000Z",
          status: "inactive"
        }
      })
    ]);

    expect(minVariantPrice(product)).toBe(200);
  });

  it("picks the cheapest variant by effective price across multiple variants", () => {
    const product = makeProduct([
      makeVariant({
        id: 1,
        price: 200,
        discount: {
          type: "percentage",
          value: 50,
          startsAt: "2000-01-01T00:00:00.000Z",
          endsAt: "2999-01-01T00:00:00.000Z",
          status: "active"
        }
      }),
      makeVariant({ id: 2, price: 150 })
    ]);

    expect(minVariantPrice(product)).toBe(100);
  });
});
