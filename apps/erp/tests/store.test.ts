import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDel = vi.fn();
const authTokenListeners: Array<(token: string | null) => void> = [];

vi.mock("@/lib/api/client", () => ({
  subscribeAdminAccessToken: (listener: (token: string | null) => void) => {
    authTokenListeners.push(listener);
    return () => {
      const index = authTokenListeners.indexOf(listener);
      if (index >= 0) authTokenListeners.splice(index, 1);
    };
  },
  api: {
    get: apiGet,
    post: apiPost,
    del: apiDel
  }
}));

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  authTokenListeners.length = 0;
});

describe("ERP store", () => {
  it("hydrates advices and orders during refetch", async () => {
    apiGet
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          title: { ar: "نصيحة", en: "Advice" },
          description: { ar: "وصف", en: "Description" },
          imagePath: "/uploads/advice.png",
          videoUrl: "https://instagram.com/capella",
          status: "active",
          sortOrder: 1,
          createdAt: "",
          updatedAt: ""
        }]
      })
      .mockResolvedValueOnce({
        items: [{
          id: 7,
          orderCode: "ABCD-007",
          customerType: "registered",
          customerId: 1,
          fullName: "Seed Customer",
          phone: "01012345678",
          email: "seed-customer@capella.test",
          governorate: "Cairo",
          cityArea: "Nasr City",
          addressLine: "Street 10",
          buildingApartment: "Building 4",
          notes: null,
          paymentMethod: "cod",
          paymentStatus: "pending",
          totalAmount: 150,
          createdAt: new Date().toISOString()
        }]
      });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    await store.refetch();

    expect(store.advices).toHaveLength(1);
    expect(store.orders).toHaveLength(1);
  });

  it("refetches when the window regains focus so stock stays current after storefront orders", async () => {
    apiGet
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          sku: "SKU-1",
          slug: "product-1",
          name: { ar: "منتج", en: "Product" },
          status: "active",
          categoryId: 5,
          variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2 }]
        }]
      })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          sku: "SKU-1",
          slug: "product-1",
          name: { ar: "منتج", en: "Product" },
          status: "active",
          categoryId: 5,
          variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 0 }]
        }]
      })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(store.products[0]?.variants[0]?.stock).toBe(2);

    window.dispatchEvent(new Event("focus"));
    await flush();

    expect(store.products[0]?.variants[0]?.stock).toBe(0);
    expect(apiGet).toHaveBeenCalledTimes(10);
  });

  it("refetches after an admin access token is restored on tab reload", async () => {
    apiGet
      .mockRejectedValueOnce(new Error("API 401 /api/erp/products"))
      .mockRejectedValueOnce(new Error("API 401 /api/erp/categories"))
      .mockRejectedValueOnce(new Error("API 401 /api/erp/offers"))
      .mockRejectedValueOnce(new Error("API 401 /api/erp/advices"))
      .mockRejectedValueOnce(new Error("API 401 /api/erp/orders"))
      .mockResolvedValueOnce({
        items: [{
          id: 1,
          sku: "SKU-1",
          slug: "product-1",
          name: { ar: "منتج", en: "Product" },
          status: "active",
          categoryId: 5,
          variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2 }]
        }]
      })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(store.products).toHaveLength(0);
    expect(store.error).toBe("API 401 /api/erp/products");

    authTokenListeners.forEach((listener) => listener("restored-access-token"));
    await flush();

    expect(store.products).toHaveLength(1);
    expect(store.error).toBeNull();
    expect(apiGet).toHaveBeenCalledTimes(10);
  });
});
