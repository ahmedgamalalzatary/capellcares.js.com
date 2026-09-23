import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  fetchProducts: vi.fn().mockResolvedValue([
    {
      id: 1,
      sku: "SKU-1",
      slug: "rose-serum",
      name: { ar: "سيروم الورد", en: "Rose Serum" },
      description: { ar: "", en: "" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: [],
      buyingPrice: 100,
      imagePath: "/rose.png",
      status: "active",
      isNew: false,
      isBestseller: false,
      categoryId: 1,
      variants: [{ id: 11, productId: 1, size: "30ml", price: 200, stock: 4 }],
      createdAt: "",
      updatedAt: ""
    }
  ]),
  fetchOffers: vi.fn().mockResolvedValue([
    { id: 2, slug: "body-care-offer", name: { ar: "عرض", en: "Offer" }, categoryId: 2, price: 300, items: [{ variantId: 11, qty: 1 }] }
  ]),
  fetchCollections: vi.fn().mockResolvedValue([
    { id: 3, slug: "body-lotion-set", name: { ar: "مجموعة", en: "Set" }, categoryId: 3, price: 400, items: [{ variantId: 11, qty: 1 }] }
  ]),
  fetchCategories: vi.fn().mockResolvedValue([
    { id: 1, parentId: null, slug: "serums", name: { ar: "سيرومات", en: "Serums" }, isLeaf: true }
  ])
}));

const authState: { user: { id: number; email: string } | null; accessToken: string | null } = {
  user: null,
  accessToken: null
};

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => authState
}));

import { clearCartLines, clearLastSyncedCartLines, saveCartLines } from "@/lib/cart";
import { CartProvider, useCart } from "@/components/providers/cart-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function CartProbe() {
  const cart = useCart();
  return createElement(
    "div",
    null,
    createElement("div", { "data-testid": "lines" }, JSON.stringify(cart.lines)),
    createElement("button", { onClick: () => cart.add({ type: "offer", offerId: 2, qty: 1 }) }, "add-offer")
  );
}

function lastPutBody(calls: unknown[][]): { lines: unknown[] } | null {
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    const [url, init] = calls[i] as [string, RequestInit | undefined];
    if (String(url).includes("/api/v1/cart") && init?.method === "PUT") {
      return JSON.parse(String(init.body)) as { lines: unknown[] };
    }
  }
  return null;
}

describe("CartProvider server sync", () => {
  beforeEach(() => {
    clearCartLines(window.localStorage);
    clearLastSyncedCartLines(window.localStorage);
    authState.user = null;
    authState.accessToken = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pulls the server cart on login and merges it with the local cart", async () => {
    saveCartLines(window.localStorage, [{ type: "product", productId: 1, variantId: 11, qty: 1 }]);

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) } as Response;
      }
      if (url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => ({ lines: [{ type: "offer", offerId: 2, qty: 2 }] }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    authState.user = { id: 7, email: "customer@capella.test" };
    authState.accessToken = "token-7";
    render(createElement(CartProvider, null, createElement(CartProbe)));

    await waitFor(() => {
      const lines = JSON.parse(screen.getByTestId("lines").textContent ?? "[]");
      expect(lines).toContainEqual({ type: "product", productId: 1, variantId: 11, qty: 1 });
      expect(lines).toContainEqual({ type: "offer", offerId: 2, qty: 2 });
    });

    // The merged cart is pushed back so other devices converge on the same lines.
    await waitFor(() => {
      const putBody = lastPutBody(fetchMock.mock.calls as unknown[][]);
      expect(putBody?.lines).toContainEqual({ type: "product", productId: 1, variantId: 11, qty: 1 });
      expect(putBody?.lines).toContainEqual({ type: "offer", offerId: 2, qty: 2 });
    });
  });

  it("sums quantities when the same line exists locally and on the server", async () => {
    saveCartLines(window.localStorage, [{ type: "offer", offerId: 2, qty: 1 }]);

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) } as Response;
      }
      if (url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => ({ lines: [{ type: "offer", offerId: 2, qty: 2 }] }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    authState.user = { id: 7, email: "customer@capella.test" };
    authState.accessToken = "token-7";
    render(createElement(CartProvider, null, createElement(CartProbe)));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual([
        { type: "offer", offerId: 2, qty: 3 }
      ]);
    });
  });

  it("pushes local cart changes to the server while signed in", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) } as Response;
      }
      if (url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => ({ lines: [] }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    authState.user = { id: 7, email: "customer@capella.test" };
    authState.accessToken = "token-7";
    render(createElement(CartProvider, null, createElement(CartProbe)));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual([]);
    });

    fireEvent.click(screen.getByRole("button", { name: "add-offer" }));

    await waitFor(() => {
      expect(lastPutBody(fetchMock.mock.calls as unknown[][])?.lines).toEqual([
        { type: "offer", offerId: 2, qty: 1 }
      ]);
    });
  });

  it("does not call the cart API when signed out", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("cart API must not be called for guests");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(CartProvider, null, createElement(CartProbe)));

    fireEvent.click(screen.getByRole("button", { name: "add-offer" }));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual([
        { type: "offer", offerId: 2, qty: 1 }
      ]);
    });
    expect(saveCartLines !== undefined).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak the previous account's local lines into the next account's cart", async () => {
    saveCartLines(window.localStorage, [{ type: "product", productId: 1, variantId: 11, qty: 1 }]);

    const serverCarts: Record<number, unknown[]> = {
      7: [{ type: "offer", offerId: 2, qty: 1 }],
      8: [{ type: "collection", collectionId: 3, qty: 1 }]
    };
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => JSON.parse(String(init.body)) } as Response;
      }
      if (url.includes("/api/v1/cart")) {
        const authHeader = String((init?.headers as Record<string, string>)?.authorization ?? "");
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const customerId = Number(token.replace("token-", ""));
        return { ok: true, json: async () => ({ lines: serverCarts[customerId] ?? [] }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    // First account: local line merges with account 7's server cart.
    authState.user = { id: 7, email: "a@capella.test" };
    authState.accessToken = "token-7";
    const view = render(createElement(CartProvider, null, createElement(CartProbe)));

    await waitFor(() => {
      const lines = JSON.parse(screen.getByTestId("lines").textContent ?? "[]");
      expect(lines).toContainEqual({ type: "product", productId: 1, variantId: 11, qty: 1 });
      expect(lines).toContainEqual({ type: "offer", offerId: 2, qty: 1 });
    });

    // Sign out, then sign in as another account on the same browser.
    authState.user = { id: 8, email: "b@capella.test" };
    authState.accessToken = "token-8";
    view.rerender(createElement(CartProvider, null, createElement(CartProbe)));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual([
        { type: "collection", collectionId: 3, qty: 1 }
      ]);
    });
  });

  it("does not re-add already-synced quantities when the page reloads", async () => {
    saveCartLines(window.localStorage, [{ type: "product", productId: 1, variantId: 11, qty: 1 }]);
    let serverLines: unknown[] = [{ type: "offer", offerId: 2, qty: 2 }];

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.includes("/api/v1/cart")) {
        serverLines = JSON.parse(String(init.body)).lines;
        return { ok: true, json: async () => ({ lines: serverLines }) } as Response;
      }
      if (url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => ({ lines: serverLines }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    authState.user = { id: 7, email: "customer@capella.test" };
    authState.accessToken = "token-7";
    const view = render(createElement(CartProvider, null, createElement(CartProbe)));

    // First visit: the local line merges into the server cart and is uploaded.
    const merged = [
      { type: "offer", offerId: 2, qty: 2 },
      { type: "product", productId: 1, variantId: 11, qty: 1 }
    ];
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual(merged);
    });
    await waitFor(() => {
      expect(lastPutBody(fetchMock.mock.calls as unknown[][])?.lines).toEqual(merged);
    });

    // Reload: same browser storage, fresh provider, server already holds the merged cart.
    view.unmount();
    render(createElement(CartProvider, null, createElement(CartProbe)));

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual(merged);
    });
    // Settle any echo upload, then the quantities must still not have doubled.
    await waitFor(() => {
      expect(lastPutBody(fetchMock.mock.calls as unknown[][])?.lines).toEqual(merged);
    });
    expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual(merged);
  });

  it("sends one upload at a time and keeps the latest snapshot while a PUT is in flight", async () => {
    let resolveFirstPut: (response: Response) => void = () => {};
    const firstPut = new Promise<Response>((resolve) => {
      resolveFirstPut = resolve;
    });
    let putCount = 0;

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.includes("/api/v1/cart")) {
        putCount += 1;
        if (putCount === 1) return firstPut;
        return { ok: true, json: async () => JSON.parse(String(init.body)) } as Response;
      }
      if (url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => ({ lines: [] }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    authState.user = { id: 7, email: "customer@capella.test" };
    authState.accessToken = "token-7";
    render(createElement(CartProvider, null, createElement(CartProbe)));

    // Wait until the initial upload is in flight.
    await waitFor(() => expect(putCount).toBe(1));

    // Cart changes while the first PUT is still in flight.
    fireEvent.click(screen.getByRole("button", { name: "add-offer" }));
    fireEvent.click(screen.getByRole("button", { name: "add-offer" }));

    await new Promise((resolve) => setTimeout(resolve, 50));

    // No second PUT may start while the first one is active.
    expect(putCount).toBe(1);
    expect(JSON.parse(screen.getByTestId("lines").textContent ?? "[]")).toEqual([
      { type: "offer", offerId: 2, qty: 2 }
    ]);

    // Completing the in-flight PUT releases exactly one follow-up upload with the latest snapshot.
    resolveFirstPut({ ok: true, json: async () => ({ lines: [] }) } as Response);
    await waitFor(() => expect(putCount).toBe(2));
    expect(lastPutBody(fetchMock.mock.calls as unknown[][])?.lines).toEqual([
      { type: "offer", offerId: 2, qty: 2 }
    ]);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(putCount).toBe(2);
  });

  it("retries a failed upload without waiting for another cart change", async () => {
    saveCartLines(window.localStorage, [{ type: "offer", offerId: 2, qty: 1 }]);
    const putBodies: unknown[] = [];

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT" && url.includes("/api/v1/cart")) {
        putBodies.push(JSON.parse(String(init.body)));
        // First upload fails like a server error would; the retry succeeds.
        if (putBodies.length === 1) return { ok: false, status: 500 } as Response;
        return { ok: true, json: async () => JSON.parse(String(init.body)) } as Response;
      }
      if (url.includes("/api/v1/cart")) {
        return { ok: true, json: async () => ({ lines: [] }) } as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    authState.user = { id: 7, email: "customer@capella.test" };
    authState.accessToken = "token-7";
    render(createElement(CartProvider, null, createElement(CartProbe)));

    await waitFor(() => expect(putBodies.length).toBe(1));
    expect(putBodies[0]).toEqual({ lines: [{ type: "offer", offerId: 2, qty: 1 }] });

    // No user action: the same snapshot is retried once the upload path frees up.
    await waitFor(() => expect(putBodies.length).toBe(2), { timeout: 5000 });
    expect(putBodies[1]).toEqual({ lines: [{ type: "offer", offerId: 2, qty: 1 }] });
  }, 10000);
});
