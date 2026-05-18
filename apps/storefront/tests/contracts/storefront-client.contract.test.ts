import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertConformsTo,
  assertForbiddenFieldsAbsent,
  storefrontCategoryContract,
  storefrontOfferContract,
  storefrontProductContract
} from "@capella/shared/tests/contracts";
import { fetchCategories, fetchOffers, fetchProducts } from "@/lib/api/client";

const productBoundaryPayload = {
  id: 101,
  sku: "BODY-LOTION-250",
  slug: "body-lotion-250",
  name: {
    ar: "لوشن الجسم",
    en: "Body Lotion"
  },
  description: {
    ar: "ترطيب يومي خفيف",
    en: "Light daily hydration"
  },
  ingredients: {
    ar: "زبدة الشيا",
    en: "Shea butter"
  },
  howToUse: {
    ar: "يستخدم بعد الاستحمام",
    en: "Apply after showering"
  },
  warnings: {
    ar: "للاستخدام الخارجي فقط",
    en: "For external use only"
  },
  keywords: ["body", "hydration"],
  imagePath: null,
  youtubeUrl: null,
  status: "active" as const,
  isNew: true,
  isBestseller: false,
  categoryId: 9,
  variants: [
    {
      id: 501,
      productId: 101,
      size: "250ml",
      price: 249.99,
      stock: 7,
      sortOrder: 1
    }
  ]
};

const offerBoundaryPayload = {
  id: 42,
  slug: "hydration-duo",
  name: {
    ar: "باقة الترطيب",
    en: "Hydration Duo"
  },
  description: {
    ar: "منتجان بسعر خاص",
    en: "Two products at a bundle price"
  },
  imagePath: null,
  price: 399.5,
  originalTotal: 480,
  stock: 4,
  status: "active" as const,
  items: [
    {
      variantId: 501,
      qty: 2
    }
  ]
};

const categoryBoundaryPayload = {
  id: 7,
  parentId: null,
  slug: "body-care",
  arName: "العناية بالجسم",
  enName: "Body Care",
  isLeaf: false,
  deletedAt: null
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storefront client contracts", () => {
  it("products conform to the shared product contract and send the active language header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [productBoundaryPayload] })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProducts({ lang: "en" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/products"),
      expect.objectContaining({
        cache: "no-store",
        headers: { "x-lang": "en" }
      })
    );
    assertConformsTo(result[0], storefrontProductContract);
    assertForbiddenFieldsAbsent(result[0], ["buyingPrice"]);
  });

  it("offers conform to the shared offer contract using raw API boundary payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [offerBoundaryPayload] })
      })
    );

    const result = await fetchOffers({ lang: "ar" });
    assertConformsTo(result[0], storefrontOfferContract);
  });

  it("categories conform to the shared category contract and normalize legacy API fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [categoryBoundaryPayload] })
      })
    );

    const result = await fetchCategories({ lang: "ar" });

    assertConformsTo(result[0], storefrontCategoryContract);
    expect(result[0]).toMatchObject({
      name: {
        ar: "العناية بالجسم",
        en: "Body Care"
      }
    });
  });
});
