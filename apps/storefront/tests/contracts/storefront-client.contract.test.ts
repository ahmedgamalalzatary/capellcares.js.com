import { afterEach, describe, expect, it, vi } from "vitest";

import {
  storefrontAdviceContract,
  assertConformsTo,
  assertForbiddenFieldsAbsent,
  storefrontCategoryContract,
  storefrontOfferContract,
  storefrontProductContract
} from "@capella/shared/tests/contracts";
import { fetchAdvices, fetchCategories, fetchOffers, fetchProducts } from "@/lib/api/client";

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
  hoverImagePath: null,
  media: [
    { type: "image", url: "/uploads/body-lotion-primary.jpg" },
    { type: "image", url: "/uploads/body-lotion-hover.jpg" },
    { type: "video", url: "/uploads/body-lotion-demo.mp4" }
  ],
  youtubeUrl: null,
  status: "active" as const,
  isNew: true,
  isBestseller: false,
  categoryId: 9,
  rating: { average: 4.5, count: 12 },
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
  imagePath: "http://localhost:4000/uploads/hydration-duo-primary.jpg",
  media: [
    { type: "image" as const, url: "http://localhost:4000/uploads/hydration-duo-primary.jpg" },
    { type: "image" as const, url: "http://localhost:4000/uploads/hydration-duo-secondary.jpg" },
    { type: "video" as const, url: "http://localhost:4000/uploads/hydration-duo-demo.mp4" }
  ],
  price: 399.5,
  originalTotal: 480,
  stock: 4,
  rating: { average: 0, count: 0 },
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
  imagePath: "/uploads/body-care.jpg",
  sortOrder: 3,
  arName: "العناية بالجسم",
  enName: "Body Care",
  isLeaf: false,
  deletedAt: null
};

const adviceBoundaryPayload = {
  id: 12,
  title: { ar: "نصيحة", en: "Advice" },
  description: { ar: "وصف", en: "Description" },
  videoUrl: "https://instagram.com/capella",
  status: "active" as const
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
        next: { revalidate: 10 },
        headers: { "x-lang": "en" }
      })
    );
    assertConformsTo(result[0], storefrontProductContract);
    assertForbiddenFieldsAbsent(result[0], ["buyingPrice"]);
    expect(result[0]?.media).toEqual([
      { type: "image", url: "http://localhost:4000/uploads/body-lotion-primary.jpg" },
      { type: "image", url: "http://localhost:4000/uploads/body-lotion-hover.jpg" },
      { type: "video", url: "http://localhost:4000/uploads/body-lotion-demo.mp4" }
    ]);
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
    expect(result[0]?.media).toEqual(offerBoundaryPayload.media);
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
      imagePath: "http://localhost:4000/uploads/body-care.jpg",
      sortOrder: 3,
      name: {
        ar: "العناية بالجسم",
        en: "Body Care"
      }
    });
  });

  it("advices conform to the shared advice contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [adviceBoundaryPayload] })
      })
    );

    const result = await fetchAdvices({ lang: "ar" });
    assertConformsTo(result[0], storefrontAdviceContract);
    expect(result[0]).not.toHaveProperty("imagePath");
  });

  it("synthesizes media from legacy imagePath-only product payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ ...productBoundaryPayload, media: undefined, imagePath: "/uploads/legacy-only.jpg" }]
        })
      })
    );

    const result = await fetchProducts({ lang: "en" });

    expect(result[0]?.media).toEqual([{ type: "image", url: "http://localhost:4000/uploads/legacy-only.jpg" }]);
  });

  it("normalizes legacy relative upload URLs to the API origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{
            ...productBoundaryPayload,
            imagePath: "/uploads/body-lotion-primary.jpg",
            hoverImagePath: "/uploads/body-lotion-hover-dedicated.jpg",
            media: [
              { type: "image", url: "/uploads/body-lotion-primary.jpg" },
              { type: "image", url: "/uploads/body-lotion-hover.jpg" }
            ]
          }]
        })
      })
    );

    const result = await fetchProducts({ lang: "en" });

    expect(result[0]?.imagePath).toBe("http://localhost:4000/uploads/body-lotion-primary.jpg");
    expect(result[0]?.hoverImagePath).toBe("http://localhost:4000/uploads/body-lotion-hover-dedicated.jpg");
    expect(result[0]?.media).toEqual([
      { type: "image", url: "http://localhost:4000/uploads/body-lotion-primary.jpg" },
      { type: "image", url: "http://localhost:4000/uploads/body-lotion-hover.jpg" }
    ]);
  });

  it("uses the public API origin for media URLs when SSR fetches through the internal Docker host", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://api:4000");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.capellacares.com");
    vi.stubGlobal("window", undefined);
    vi.resetModules();

    const { fetchProducts: fetchProductsWithEnv } = await import("@/lib/api/client");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          ...productBoundaryPayload,
          imagePath: "/uploads/body-lotion-primary.jpg",
          media: [{ type: "image", url: "/uploads/body-lotion-primary.jpg" }]
        }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProductsWithEnv({ lang: "en" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("http://api:4000/api/v1/products"),
      expect.any(Object)
    );
    expect(result[0]?.imagePath).toBe("https://api.capellacares.com/uploads/body-lotion-primary.jpg");
    expect(result[0]?.media?.[0]?.url).toBe("https://api.capellacares.com/uploads/body-lotion-primary.jpg");
  });

  it("normalizes numeric product ids so category-scoped filtering does not empty out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{
            ...productBoundaryPayload,
            id: "101",
            categoryId: "9",
            variants: [
              {
                ...productBoundaryPayload.variants[0],
                id: "501",
                productId: "101"
              }
            ]
          }]
        })
      })
    );

    const [product] = await fetchProducts({ lang: "en", category: "serums" });

    expect(product).toMatchObject({
      id: 101,
      categoryId: 9,
      variants: [{ id: 501, productId: 101 }]
    });
  });

  it("filters product payloads with missing numeric ids instead of returning NaN", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{
            ...productBoundaryPayload,
            id: undefined,
            categoryId: null
          }]
        })
      })
    );

    await expect(fetchProducts({ lang: "en", throwOnError: true })).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to normalize product payload"),
      expect.objectContaining({
        error: expect.any(Error),
        product: expect.objectContaining({
          id: undefined,
          categoryId: null
        })
      })
    );
  });
});
