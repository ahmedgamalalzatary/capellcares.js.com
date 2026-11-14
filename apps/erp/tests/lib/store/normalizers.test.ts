import { describe, expect, it } from "vitest";

import { normalizeCategory, normalizeProduct } from "@/lib/store/normalizers";

describe("normalizeCategory", () => {
  it("preserves both main-category shop image paths from the API", () => {
    const input = {
      id: 1,
      parentId: null,
      slug: "body-care",
      arName: "Body AR",
      enName: "Body Care",
      imagePath: null,
      arShopImagePath: "/uploads/body-ar.webp",
      enShopImagePath: "/uploads/body-en.webp",
      isLeaf: false,
      deletedAt: null
    };

    expect(normalizeCategory(input)).toMatchObject({
      imagePath: null,
      arShopImagePath: "/uploads/body-ar.webp",
      enShopImagePath: "/uploads/body-en.webp"
    });
  });

  it("normalizes absent shop pictures to null while preserving a child category's image", () => {
    expect(normalizeCategory({
      id: 2,
      parentId: 1,
      slug: "serums",
      imagePath: "/uploads/serums.webp"
    })).toMatchObject({
      imagePath: "/uploads/serums.webp",
      arShopImagePath: null,
      enShopImagePath: null
    });
  });
});

describe("normalizeProduct", () => {
  it("preserves offerIds from the API payload", () => {
    const product = normalizeProduct({
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      keywords: [],
      imagePath: "/uploads/product.jpg",
      status: "active",
      categoryId: 5,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2 }],
      offerIds: [7, 9]
    } as any);

    expect(product.offerIds).toEqual([7, 9]);
  });
});

