import { describe, expect, it } from "vitest";

import { normalizeProduct } from "@/lib/store/normalizers";

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

