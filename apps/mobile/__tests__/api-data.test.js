jest.mock("../src/lib/api/base", () => ({
  API_BASE: "https://api.example.com"
}));

describe("mobile API normalization", () => {
  test("resolves upload paths while preserving absolute and non-upload values", () => {
    let normalizers = {};
    try {
      normalizers = require("../src/lib/api/normalizers");
    } catch {}

    expect(typeof normalizers.resolveMediaUrl).toBe("function");
    expect(normalizers.resolveMediaUrl(" /uploads/product.jpg ")).toBe(
      "https://api.example.com/uploads/product.jpg"
    );
    expect(normalizers.resolveMediaUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg"
    );
    expect(
      normalizers.resolveMediaUrl("http://localhost:4000/uploads/local.jpg")
    ).toBe("https://api.example.com/uploads/local.jpg");
    expect(
      normalizers.resolveMediaUrl("http://127.0.0.1:4000/uploads/local.jpg")
    ).toBe("https://api.example.com/uploads/local.jpg");
    expect(normalizers.resolveMediaUrl("asset-key")).toBe("asset-key");
    expect(normalizers.resolveMediaUrl(null)).toBe("");
  });

  test("normalizes category ids, names, sorting, and media", () => {
    const { normalizeCategory } = require("../src/lib/api/normalizers");

    expect(
      normalizeCategory({
        id: "4",
        parentId: "2",
        slug: "care",
        imagePath: "/uploads/category.jpg",
        sortOrder: "7",
        arName: "عناية",
        enName: "Care"
      })
    ).toEqual(
      expect.objectContaining({
        id: 4,
        parentId: 2,
        name: { ar: "عناية", en: "Care" },
        imagePath: "https://api.example.com/uploads/category.jpg",
        sortOrder: 7
      })
    );
  });

  test("normalizes products, variant ids, discounts, media, and related cards", () => {
    const { normalizeProduct } = require("../src/lib/api/normalizers");
    const product = normalizeProduct({
      id: "8",
      categoryId: "3",
      imagePath: "/uploads/product.jpg",
      hoverImagePath: "/uploads/hover.jpg",
      media: [
        { type: "image", arUrl: "/uploads/ar.jpg", enUrl: "/uploads/en.jpg" },
        { type: "video", url: "https://youtube.com/watch?v=1" }
      ],
      variants: [
        {
          id: "10",
          productId: "8",
          discount: { id: "5", variantId: "10", value: "15" }
        }
      ],
      relatedItems: [{ imagePath: "/uploads/related.jpg" }]
    });

    expect(product).toEqual(
      expect.objectContaining({
        id: 8,
        categoryId: 3,
        imagePath: "https://api.example.com/uploads/product.jpg",
        hoverImagePath: "https://api.example.com/uploads/hover.jpg"
      })
    );
    expect(product.media[0]).toEqual({
      type: "image",
      arUrl: "https://api.example.com/uploads/ar.jpg",
      enUrl: "https://api.example.com/uploads/en.jpg"
    });
    expect(product.variants[0]).toEqual(
      expect.objectContaining({
        id: 10,
        productId: 8,
        discount: expect.objectContaining({ id: 5, variantId: 10, value: 15 })
      })
    );
    expect(product.relatedItems[0].imagePath).toBe(
      "https://api.example.com/uploads/related.jpg"
    );
  });

  test.each(["normalizeOffer", "normalizeCollection"])(
    "%s resolves bundle and related-card media",
    (normalizerName) => {
      const normalizer = require("../src/lib/api/normalizers")[normalizerName];
      const value = normalizer({
        imagePath: "/uploads/bundle.jpg",
        media: [{ type: "image", arUrl: null, enUrl: "/uploads/bundle-en.jpg" }],
        relatedItems: [{ imagePath: "/uploads/related.jpg" }]
      });

      expect(value.imagePath).toBe("https://api.example.com/uploads/bundle.jpg");
      expect(value.media[0].enUrl).toBe(
        "https://api.example.com/uploads/bundle-en.jpg"
      );
      expect(value.relatedItems[0].imagePath).toBe(
        "https://api.example.com/uploads/related.jpg"
      );
    }
  );

  test("resolves shop-section and wishlist media", () => {
    const {
      normalizeShopMediaSection,
      normalizeWishlistEntry
    } = require("../src/lib/api/normalizers");

    const section = normalizeShopMediaSection({
      id: 1,
      slot: 1,
      status: "active",
      items: [
        {
          arImagePath: "/uploads/ar.jpg",
          arMobileImagePath: "/uploads/ar-mobile.jpg",
          enImagePath: null,
          enMobileImagePath: "/uploads/en-mobile.jpg"
        }
      ]
    });
    expect(section.items[0]).toEqual(
      expect.objectContaining({
        arImagePath: "https://api.example.com/uploads/ar.jpg",
        arMobileImagePath: "https://api.example.com/uploads/ar-mobile.jpg",
        enImagePath: null,
        enMobileImagePath: "https://api.example.com/uploads/en-mobile.jpg"
      })
    );
    expect(
      normalizeWishlistEntry({ imagePath: "/uploads/wish.jpg" }).imagePath
    ).toBe("https://api.example.com/uploads/wish.jpg");
  });

  test.each([
    ["/products/serum", "/product/serum"],
    ["/offers/summer", "/offer/summer"],
    ["/collections/routine", "/collection/routine"],
    [null, null]
  ])("maps wishlist href %s to the native route", (href, expected) => {
    const { normalizeWishlistEntry } = require("../src/lib/api/normalizers");

    expect(normalizeWishlistEntry({ imagePath: null, href }).href).toBe(expected);
  });

  test("normalizes review-prompt media and its native href", () => {
    const { normalizeReviewPrompt } = require("../src/lib/api/normalizers");

    expect(
      normalizeReviewPrompt({
        imagePath: "/uploads/prompt.jpg",
        href: "/products/serum"
      })
    ).toEqual(
      expect.objectContaining({
        imagePath: "https://api.example.com/uploads/prompt.jpg",
        href: "/product/serum"
      })
    );
  });

  test("rejects invalid required product ids", () => {
    const { normalizeProduct } = require("../src/lib/api/normalizers");

    expect(() =>
      normalizeProduct({ id: 0, categoryId: 1, variants: [], media: [] })
    ).toThrow("Invalid product id");
  });
});

describe("mobile catalog selectors", () => {
  const categories = [
    { id: 1, parentId: null, slug: "root", deletedAt: null },
    { id: 2, parentId: 1, slug: "leaf", deletedAt: null },
    { id: 3, parentId: 2, slug: "leaf", deletedAt: "deleted" }
  ];

  test("finds active categories and builds a guarded ancestor path", () => {
    let selectors = {};
    try {
      selectors = require("../src/lib/api/selectors");
    } catch {}

    expect(typeof selectors.getCategoryPath).toBe("function");
    expect(selectors.getCategoryById(categories, 3)).toBeUndefined();
    expect(selectors.getCategoryBySlug(categories, "leaf")).toBe(categories[1]);
    expect(selectors.getCategoryPath(categories, 2)).toEqual([
      categories[0],
      categories[1]
    ]);
  });

  test("finds offers containing any variant of the requested product", () => {
    const { getOffersForProduct } = require("../src/lib/api/selectors");
    const products = [{ id: 4, variants: [{ id: 10 }, { id: 11 }] }];
    const offers = [
      { id: 1, items: [{ variantId: 9 }] },
      { id: 2, items: [{ variantId: 11 }] }
    ];

    expect(getOffersForProduct(offers, products, 4)).toEqual([offers[1]]);
    expect(getOffersForProduct(offers, products, 99)).toEqual([]);
  });
});
