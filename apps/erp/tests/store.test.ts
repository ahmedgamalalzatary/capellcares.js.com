import { afterEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDel = vi.fn();

vi.mock("@/lib/api/client", () => ({
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
});

describe("ERP store", () => {
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
      .mockResolvedValueOnce({ items: [] });

    const { getStore } = await import("@/lib/store");
    const store = getStore();

    store.ensureLoaded();
    await flush();

    expect(store.products[0]?.variants[0]?.stock).toBe(2);

    window.dispatchEvent(new Event("focus"));
    await flush();

    expect(store.products[0]?.variants[0]?.stock).toBe(0);
    expect(apiGet).toHaveBeenCalledTimes(6);
  });
});
