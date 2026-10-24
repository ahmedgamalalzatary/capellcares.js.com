import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: 1, email: "user@capella.test" },
    accessToken: "test-token"
  })
}));

import { WishlistProvider, useWishlist } from "@/components/providers/wishlist-provider";

const savedItem = { entityType: "product", entityId: 1, name: { ar: "A", en: "A" }, imagePath: null, href: "/products/a", availability: "available" };

function Probe() {
  const wishlist = useWishlist();
  return createElement("div", null,
    createElement("div", { "data-testid": "ids" }, wishlist.ids.join(",")),
    createElement("div", { "data-testid": "items" }, wishlist.items.map((item) => `${item.entityType}:${item.entityId}`).join(",")),
    createElement("div", { "data-testid": "has-1" }, String(wishlist.has("product", 1))),
    createElement("button", { onClick: () => wishlist.remove("product", 1) }, "remove"),
    createElement("button", { onClick: () => wishlist.toggle("offer", 9) }, "add-offer")
  );
}

function stubFetch() {
  let items: unknown[] = [savedItem];
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      items = [];
      return { ok: true } as Response;
    }
    if (init?.method === "POST") {
      items = [...items, { ...savedItem, entityType: "offer", entityId: 9 }];
    }
    return { ok: true, json: async () => ({ items }) } as Response;
  });
}

describe("WishlistProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("adds an entity optimistically and tells the API", async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(WishlistProvider, null, createElement(Probe)));
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("product:1"));

    fireEvent.click(screen.getByRole("button", { name: "add-offer" }));

    // The heart fills before the request settles.
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("product:1,offer:9"));
    expect(
      fetchMock.mock.calls.some(([url, init]) => String(url).includes("/api/v1/wishlist") && init?.method === "POST")
    ).toBe(true);
  });

  it("removes an entity when the API confirms the delete", async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(WishlistProvider, null, createElement(Probe)));
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("product:1"));

    fireEvent.click(screen.getByRole("button", { name: "remove" }));

    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent(""));
    expect(screen.getByTestId("has-1")).toHaveTextContent("false");
    expect(
      fetchMock.mock.calls.some(([url, init]) =>
        String(url).includes("/api/v1/wishlist/product/1") && init?.method === "DELETE")
    ).toBe(true);
  });

  it("refreshes after an optimistic delete when the API responds with a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "DELETE" && url.includes("/api/v1/wishlist/product/1")) {
        return { ok: false, status: 500 } as Response;
      }

      return { ok: true, json: async () => ({ items: [savedItem] }) } as Response;
    }));

    render(createElement(WishlistProvider, null, createElement(Probe)));

    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("product:1"));

    fireEvent.click(screen.getByRole("button", { name: "remove" }));

    // The failed delete is rolled back: the item comes back rather than vanishing.
    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("product:1"));
    expect(
      vi.mocked(fetch).mock.calls.some(([url, init]) =>
        String(url).includes("/api/v1/wishlist/product/1") && init?.method === "DELETE")
    ).toBe(true);
  });
});