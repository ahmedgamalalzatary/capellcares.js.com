import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDel = vi.fn();
const authTokenListeners: Array<(token: string | null) => void> = [];
const authHydrationListeners: Array<(hydrated: boolean) => void> = [];
const authUserListeners: Array<(user: unknown) => void> = [];
let adminAuthHydrated = true;
let adminAuthUser: unknown = {
  name: "Admin User",
  email: "admin@capella.test",
  role: "admin",
  permissionKeys: [
    "dashboard.read",
    "products.read",
    "categories.read",
    "collections.read",
    "offers.read",
    "advices.read",
    "shop_media.read",
    "orders.read",
    "sales.read",
    "trash.read"
  ]
};

vi.mock("@/lib/api/client", () => ({
  subscribeAdminAccessToken: (listener: (token: string | null) => void) => {
    authTokenListeners.push(listener);
    return () => {
      const index = authTokenListeners.indexOf(listener);
      if (index >= 0) authTokenListeners.splice(index, 1);
    };
  },
  subscribeAdminAuthHydration: (listener: (hydrated: boolean) => void) => {
    authHydrationListeners.push(listener);
    return () => {
      const index = authHydrationListeners.indexOf(listener);
      if (index >= 0) authHydrationListeners.splice(index, 1);
    };
  },
  subscribeAdminAuthUser: (listener: (user: unknown) => void) => {
    authUserListeners.push(listener);
    return () => {
      const index = authUserListeners.indexOf(listener);
      if (index >= 0) authUserListeners.splice(index, 1);
    };
  },
  getAdminAuthUser: () => adminAuthUser,
  isAdminAuthHydrated: () => adminAuthHydrated,
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
  authHydrationListeners.length = 0;
  authUserListeners.length = 0;
  adminAuthHydrated = true;
  adminAuthUser = {
    name: "Admin User",
    email: "admin@capella.test",
    role: "admin",
    permissionKeys: [
      "dashboard.read",
      "products.read",
      "categories.read",
      "collections.read",
      "offers.read",
      "advices.read",
      "shop_media.read",
      "orders.read",
      "sales.read",
      "trash.read"
    ]
  };
});

describe("ERP store", () => {
  it("hydrates advices and orders during refetch", async () => {
    apiGet
      .mockResolvedValueOnce({ items: [] })
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
      .mockResolvedValueOnce({ items: [] })
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
      })
      .mockResolvedValueOnce({
        summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 },
        productTotals: [],
        variantTotals: [],
        orders: []
      });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    await store.refetch();

    expect(store.advices).toHaveLength(1);
    expect(store.orders).toHaveLength(1);
  });

  it("hydrates shop media sections during refetch", async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/erp/shop-media-sections") {
        return {
          items: [{
            id: 1,
            slot: 1,
            status: "active",
            items: [{
              id: 10,
              imagePath: "/uploads/shop-media.jpg",
              targetType: "offers",
              targetId: null,
              sortOrder: 1
            }]
          }]
        };
      }
      if (path === "/api/erp/sales") {
        return { summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 }, productTotals: [], variantTotals: [], orders: [] };
      }
      return { items: [] };
    });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    await store.refetch();

    expect((store as any).shopMediaSections).toHaveLength(1);
  });

  it("hydrates collections during refetch", async () => {
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/erp/collections") {
        return {
          items: [{
            id: 9,
            slug: "skin-care-set",
            name: { ar: "مجموعة عناية", en: "Care Collection" },
            description: { ar: "وصف", en: "Description" },
            imagePath: "/uploads/collection.png",
            price: 120,
            originalTotal: 150,
            categoryId: 5,
            items: [
              { variantId: 11, qty: 1 },
              { variantId: 12, qty: 1 }
            ],
            stock: 3,
            status: "active",
            visibility: "visible",
            createdAt: "",
            updatedAt: ""
          }]
        };
      }
      if (path === "/api/erp/sales") {
        return { summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 }, productTotals: [], variantTotals: [], orders: [] };
      }
      return { items: [] };
    });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    await store.refetch();

    expect((store as any).collections).toHaveLength(1);
  });

  it("refetches when the window regains focus so stock stays current after storefront orders", async () => {
    let productFetchCount = 0;
    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/erp/products") {
        productFetchCount += 1;
        return {
          items: [{
            id: 1,
            sku: "SKU-1",
            slug: "product-1",
            name: { ar: "منتج", en: "Product" },
            status: "active",
            categoryId: 5,
            variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: productFetchCount === 1 ? 2 : 0 }]
          }]
        };
      }
      if (path === "/api/erp/sales") {
        return { summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 }, productTotals: [], variantTotals: [], orders: [] };
      }
      return { items: [] };
    });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(store.products[0]?.variants[0]?.stock).toBe(2);

    window.dispatchEvent(new Event("focus"));
    await flush();

    expect(store.products[0]?.variants[0]?.stock).toBe(0);
    expect(apiGet).toHaveBeenCalledTimes(16);
  });

  it("refetches after an admin access token is restored on tab reload", async () => {
    let restored = false;
    apiGet.mockImplementation(async (path: string) => {
      if (!restored) {
        throw new Error(`API 401 ${path}`);
      }
      if (path === "/api/erp/products") {
        return {
          items: [{
            id: 1,
            sku: "SKU-1",
            slug: "product-1",
            name: { ar: "منتج", en: "Product" },
            status: "active",
            categoryId: 5,
            variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2 }]
          }]
        };
      }
      if (path === "/api/erp/sales") {
        return { summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 }, productTotals: [], variantTotals: [], orders: [] };
      }
      return { items: [] };
    });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(store.products).toHaveLength(0);
    expect(store.error).toBe("API 401 /api/erp/products");

    restored = true;
    authTokenListeners.forEach((listener) => listener("restored-access-token"));
    await flush();

    expect(store.products).toHaveLength(1);
    expect(store.error).toBeNull();
    expect(apiGet).toHaveBeenCalledTimes(16);
  });

  it("waits for admin auth hydration before the initial ERP fetch on tab reload", async () => {
    adminAuthHydrated = false;

    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/erp/products") {
        return {
          items: [{
            id: 1,
            sku: "SKU-1",
            slug: "product-1",
            name: { ar: "منتج", en: "Product" },
            status: "active",
            categoryId: 5,
            variants: [{ id: 11, productId: 1, size: "100ml", price: 50, stock: 2 }]
          }]
        };
      }
      if (path === "/api/erp/sales") {
        return { summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 }, productTotals: [], variantTotals: [], orders: [] };
      }
      return { items: [] };
    });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(apiGet).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);
    expect(store.loaded).toBe(false);

    authTokenListeners.forEach((listener) => listener("restored-access-token"));
    await flush();

    expect(apiGet).not.toHaveBeenCalled();

    authHydrationListeners.forEach((listener) => listener(true));
    await flush();

    expect(store.products).toHaveLength(1);
    expect(store.error).toBeNull();
    expect(apiGet).toHaveBeenCalledTimes(8);
  });

  it("preloads only datasets allowed by the current staff permissions", async () => {
    adminAuthUser = {
      name: "Staff User",
      email: "staff@capella.test",
      role: "staff",
      permissionKeys: ["dashboard.read", "orders.read", "sales.read"]
    };

    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/erp/orders") return { items: [] };
      if (path === "/api/erp/sales") return { summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 }, productTotals: [], variantTotals: [], orders: [] };
      throw new Error(`Unexpected path ${path}`);
    });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(apiGet.mock.calls.map(([path]) => path)).toEqual([
      "/api/erp/orders",
      "/api/erp/sales"
    ]);
    expect(store.loaded).toBe(true);
    expect(store.error).toBeNull();
  });

  it("applies permission changes on the next protected interaction without re-login", async () => {
    adminAuthUser = {
      name: "Staff User",
      email: "staff@capella.test",
      role: "staff",
      permissionKeys: ["orders.read"]
    };

    apiGet
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ summary: { totalOrders: 0, totalUnitsSold: 0, totalRevenue: 0 }, productTotals: [], variantTotals: [], orders: [] });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(apiGet.mock.calls.map(([path]) => path)).toEqual(["/api/erp/orders"]);

    adminAuthUser = {
      name: "Staff User",
      email: "staff@capella.test",
      role: "staff",
      permissionKeys: ["orders.read", "sales.read"]
    };
    authUserListeners.forEach((listener) => listener(adminAuthUser));
    await flush();

    expect(apiGet.mock.calls.map(([path]) => path)).toEqual([
      "/api/erp/orders",
      "/api/erp/orders",
      "/api/erp/sales"
    ]);
    expect(store.error).toBeNull();
  });

  it("keeps unrelated authorized datasets when one staff preload request fails", async () => {
    adminAuthUser = {
      name: "Staff User",
      email: "staff@capella.test",
      role: "staff",
      permissionKeys: ["orders.read", "sales.read"]
    };

    apiGet.mockImplementation(async (path: string) => {
      if (path === "/api/erp/orders") {
        return {
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
        };
      }
      if (path === "/api/erp/sales") {
        throw new Error("API 403 /api/erp/sales");
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    await store.refetch();

    expect(store.orders).toHaveLength(1);
    expect(store.loaded).toBe(true);
    expect(store.error).toBe("API 403 /api/erp/sales");
  });
});
