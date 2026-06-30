import { describe, expect, it } from "vitest";
import type { Metadata } from "next";

import { buildProductMetadata, productJsonLd } from "@/lib/seo";

describe("SEO metadata", () => {
  it("uses a Next.js-supported OpenGraph type for product pages", () => {
    const metadata = buildProductMetadata("en", {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "وصف", en: "Description" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: ["test"],
      buyingPrice: 10,
      imagePath: "/uploads/product.jpg",
      media: [{ type: "image", url: "/uploads/product.jpg" }],
      status: "active",
      isNew: false,
      isBestseller: false,
      categoryId: 2,
      variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    });

    expect((metadata.openGraph as Metadata["openGraph"] & { type?: string })?.type).toBe("website");
  });

  it("prices the Product JSON-LD offer at the active discounted price, matching what shoppers see on the page", () => {
    const jsonLd = productJsonLd("en", {
      id: 1,
      sku: "SKU-1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "وصف", en: "Description" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: ["test"],
      buyingPrice: 10,
      imagePath: "/uploads/product.jpg",
      status: "active",
      isNew: false,
      isBestseller: false,
      categoryId: 2,
      variants: [
        {
          id: 11,
          productId: 1,
          size: "100ml",
          price: 200,
          stock: 2,
          discount: {
            type: "percentage",
            value: 50,
            startsAt: "2000-01-01T00:00:00.000Z",
            endsAt: "2999-01-01T00:00:00.000Z",
            status: "active"
          }
        }
      ],
      createdAt: "",
      updatedAt: ""
    });

    expect(jsonLd.offers?.price).toBe(100);
  });
});
