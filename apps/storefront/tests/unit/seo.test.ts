import { describe, expect, it } from "vitest";
import type { Metadata } from "next";

import { buildLocaleMetadata, buildProductMetadata, buildRootMetadata, buildShopMetadata, productJsonLd, websiteJsonLd } from "@/lib/seo";

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
      media: [{ type: "image", arUrl: null, enUrl: "/uploads/product.jpg" }],
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
      reviewData: {
        summary: { averageRating: 4.5, reviewCount: 12, distribution: { "1": 0, "2": 0, "3": 2, "4": 2, "5": 8 } },
        items: [],
        pagination: { page: 1, pageSize: 10, total: 12, totalPages: 2 }
      },
      createdAt: "",
      updatedAt: ""
    });

    expect(jsonLd.offers?.price).toBe(100);
    expect(jsonLd.offers?.priceCurrency).toBe("KWD");
    expect(jsonLd.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 12 });
  });

  it("titles the home (shop) page with the brand name and what it sells, without the brand suffix repeated", () => {
    expect(buildShopMetadata("en").title).toEqual({ absolute: "Falta Toy | Toy shop for kids" });
    expect(buildShopMetadata("ar").title).toEqual({ absolute: "فلتة توي | متجر ألعاب أطفال" });
  });

  it("presents the shop as Kuwaiti, without promising free delivery", () => {
    const root = buildRootMetadata();
    const text = JSON.stringify([root, buildLocaleMetadata("en"), buildLocaleMetadata("ar"), websiteJsonLd()]);
    expect(text).not.toMatch(/Egypt|مصر|EGP|ar[-_]EG|en-EG|Free delivery|توصيل مجاني/);
    expect(JSON.stringify(root.title)).toMatch(/Kuwait/);
    expect((buildLocaleMetadata("ar").openGraph as { locale?: string }).locale).toBe("ar_KW");
    expect(websiteJsonLd().inLanguage).toEqual(["ar-KW", "en-KW"]);
  });
});
