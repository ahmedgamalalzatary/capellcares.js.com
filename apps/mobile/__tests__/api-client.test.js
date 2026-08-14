jest.mock("../src/lib/api/base", () => ({
  API_BASE: "https://api.example.com"
}));

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(body == null ? "" : JSON.stringify(body))
  };
}

const product = {
  id: 1,
  categoryId: 2,
  slug: "serum one",
  imagePath: "/uploads/product.jpg",
  media: [],
  variants: []
};
const offer = {
  id: 3,
  slug: "offer one",
  imagePath: "/uploads/offer.jpg",
  media: [],
  items: []
};
const collection = {
  id: 4,
  slug: "collection one",
  imagePath: "/uploads/collection.jpg",
  media: [],
  items: []
};

describe("mobile API client", () => {
  let client;
  let http;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    http = require("../src/lib/api/http");
    http.configureAuthSessionAdapter(null);
    client = require("../src/lib/api/client");
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("fetches and normalizes every catalog list", async () => {
    global.fetch
      .mockResolvedValueOnce(response(200, { items: [product] }))
      .mockResolvedValueOnce(
        response(200, {
          items: [
            {
              id: 2,
              parentId: null,
              slug: "care",
              name: { ar: "عناية", en: "Care" },
              imagePath: "/uploads/category.jpg"
            }
          ]
        })
      )
      .mockResolvedValueOnce(response(200, { items: [offer] }))
      .mockResolvedValueOnce(response(200, { items: [collection] }));

    const products = await client.fetchProducts({
      q: "face wash",
      category: "skin/care",
      categoryId: "2",
      lang: "en",
      throwOnError: true
    });
    const categories = await client.fetchCategories({ lang: "en" });
    const offers = await client.fetchOffers({ lang: "en" });
    const collections = await client.fetchCollections({ lang: "en" });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/api/v1/products?q=face+wash&category=skin%2Fcare&categoryId=2",
      { headers: { "x-lang": "en" }, signal: expect.anything() }
    );
    expect(products[0].imagePath).toBe(
      "https://api.example.com/uploads/product.jpg"
    );
    expect(categories[0].imagePath).toBe(
      "https://api.example.com/uploads/category.jpg"
    );
    expect(offers[0].imagePath).toBe("https://api.example.com/uploads/offer.jpg");
    expect(collections[0].imagePath).toBe(
      "https://api.example.com/uploads/collection.jpg"
    );
  });

  test("encodes slugs for every catalog detail endpoint", async () => {
    global.fetch
      .mockResolvedValueOnce(response(200, product))
      .mockResolvedValueOnce(response(200, { ...product, reviewData: null }))
      .mockResolvedValueOnce(response(200, offer))
      .mockResolvedValueOnce(response(200, { ...offer, reviewData: null }))
      .mockResolvedValueOnce(response(200, collection))
      .mockResolvedValueOnce(response(200, { ...collection, reviewData: null }));

    await client.fetchProductBySlug("serum/one", { lang: "ar" });
    await client.fetchProductDetailBySlug("serum/one", { lang: "ar" });
    await client.fetchOfferBySlug("offer/one", { lang: "ar" });
    await client.fetchOfferDetailBySlug("offer/one", { lang: "ar" });
    await client.fetchCollectionBySlug("collection/one", { lang: "ar" });
    await client.fetchCollectionDetailBySlug("collection/one", { lang: "ar" });

    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.com/api/v1/products/serum%2Fone",
      "https://api.example.com/api/v1/products/serum%2Fone",
      "https://api.example.com/api/v1/offers/offer%2Fone",
      "https://api.example.com/api/v1/offers/offer%2Fone",
      "https://api.example.com/api/v1/collections/collection%2Fone",
      "https://api.example.com/api/v1/collections/collection%2Fone"
    ]);
  });

  test("fetches advice, shop media, and paginated public reviews", async () => {
    global.fetch
      .mockResolvedValueOnce(response(200, { items: [{ id: 1 }] }))
      .mockResolvedValueOnce(
        response(200, {
          items: [
            {
              id: 1,
              slot: 1,
              status: "active",
              items: [
                {
                  arImagePath: "/uploads/banner.jpg",
                  arMobileImagePath: null,
                  enImagePath: null,
                  enMobileImagePath: null
                }
              ]
            }
          ]
        })
      )
      .mockResolvedValueOnce(response(200, { items: [], pagination: {} }));

    await client.fetchAdvices({ lang: "ar" });
    const sections = await client.fetchShopMediaSections({ lang: "ar" });
    await client.fetchPublicReviews("product", 8, 2, 20, { lang: "ar" });

    expect(sections[0].items[0].arImagePath).toBe(
      "https://api.example.com/uploads/banner.jpg"
    );
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.com/api/v1/advices",
      "https://api.example.com/api/v1/shop-media-sections",
      "https://api.example.com/api/v1/reviews/product/8?page=2&pageSize=20"
    ]);
  });

  test("covers orders, reviews, and all wishlist operations", async () => {
    global.fetch
      .mockResolvedValueOnce(response(200, { items: [{ id: 5 }] }))
      .mockResolvedValueOnce(response(200, { id: 5 }))
      .mockResolvedValueOnce(response(201, { id: 9 }))
      .mockResolvedValueOnce(
        response(200, {
          entityType: "product",
          entityId: 1,
          name: { ar: "سيروم", en: "Serum" },
          imagePath: "/uploads/prompt.jpg",
          href: "/products/serum"
        })
      )
      .mockResolvedValueOnce(
        response(200, {
          items: [
            {
              entityType: "product",
              entityId: 1,
              name: { ar: "سيروم", en: "Serum" },
              imagePath: "/uploads/wish.jpg",
              href: "/products/serum",
              availability: "available"
            }
          ]
        })
      )
      .mockResolvedValueOnce(response(200, { ok: true }))
      .mockResolvedValueOnce(response(200, { ok: true }));

    await client.fetchCustomerOrders("token", { lang: "en" });
    await client.fetchCustomerOrderById(5, "token", { lang: "en" });
    await client.submitReview(
      "token",
      { entityType: "product", entityId: 1, rating: 5, comment: "Great" },
      { lang: "en" }
    );
    const prompt = await client.claimReviewPrompt("token", { lang: "en" });
    const wishlist = await client.fetchWishlist("token", { lang: "en" });
    await client.addWishlistItem("token", "offer", 7, { lang: "en" });
    await client.removeWishlistItem("token", "collection", 8, { lang: "en" });

    expect(wishlist[0].imagePath).toBe(
      "https://api.example.com/uploads/wish.jpg"
    );
    expect(wishlist[0].href).toBe("/product/serum");
    expect(prompt).toEqual(
      expect.objectContaining({
        imagePath: "https://api.example.com/uploads/prompt.jpg",
        href: "/product/serum"
      })
    );
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.com/api/v1/orders",
      "https://api.example.com/api/v1/orders/5",
      "https://api.example.com/api/v1/reviews",
      "https://api.example.com/api/v1/reviews/prompt/claim",
      "https://api.example.com/api/v1/wishlist",
      "https://api.example.com/api/v1/wishlist",
      "https://api.example.com/api/v1/wishlist/collection/8"
    ]);
    expect(global.fetch.mock.calls[2][1]).toEqual(expect.objectContaining({
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "x-lang": "en",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        entityType: "product",
        entityId: 1,
        rating: 5,
        comment: "Great"
      })
    }));
    expect(global.fetch.mock.calls[5][1]).toEqual(expect.objectContaining({
      method: "POST",
      headers: {
        authorization: "Bearer token",
        "x-lang": "en",
        "content-type": "application/json"
      },
      body: JSON.stringify({ entityType: "offer", entityId: 7 })
    }));
    expect(global.fetch.mock.calls[6][1]).toEqual(expect.objectContaining({
      method: "DELETE",
      headers: { authorization: "Bearer token", "x-lang": "en" },
      body: undefined
    }));
  });

  test("returns null when no review prompt is available", async () => {
    global.fetch.mockResolvedValue(response(204, null));

    await expect(client.claimReviewPrompt("token", { lang: "ar" })).resolves.toBeNull();
  });

  test("refreshes and retries checkout once after authentication rejects the request", async () => {
    const refreshAccessToken = jest.fn().mockResolvedValue("new-token");
    http.configureAuthSessionAdapter({
      getAccessToken: () => "old-token",
      getSessionRevision: () => 1,
      refreshAccessToken
    });
    global.fetch
      .mockResolvedValueOnce(response(401, { message: "Authentication expired" }))
      .mockResolvedValueOnce(response(201, { id: 9, orderCode: "ORD-9", paymentStatus: "pending" }));

    await expect(
      client.submitCheckout({ items: [] }, "old-token", { lang: "ar" })
    ).resolves.toMatchObject({ orderCode: "ORD-9" });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("drops malformed catalog and wishlist rows without losing valid siblings", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const category = { id: 2, parentId: null, slug: "care", name: { ar: "Care", en: "Care" } };
    const wishlist = {
      entityType: "product",
      entityId: 1,
      name: { ar: "Serum", en: "Serum" },
      imagePath: null,
      href: "/products/serum",
      availability: "available"
    };
    global.fetch
      .mockResolvedValueOnce(response(200, { items: [category, { ...category, id: 0 }] }))
      .mockResolvedValueOnce(response(200, { items: [offer, { ...offer, id: 0 }] }))
      .mockResolvedValueOnce(response(200, { items: [collection, { ...collection, id: 0 }] }))
      .mockResolvedValueOnce(response(200, { items: [wishlist, { ...wishlist, entityId: 0 }] }));

    await expect(client.fetchCategories()).resolves.toHaveLength(1);
    await expect(client.fetchOffers()).resolves.toHaveLength(1);
    await expect(client.fetchCollections()).resolves.toHaveLength(1);
    await expect(client.fetchWishlist("token")).resolves.toHaveLength(1);
  });

  test("drops a malformed shop-media section without losing valid siblings", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const valid = { id: 1, slot: 1, status: "active", items: [] };
    global.fetch.mockResolvedValue(response(200, { items: [valid, { id: 2 }] }));

    await expect(client.fetchShopMediaSections()).resolves.toEqual([valid]);
  });
});
