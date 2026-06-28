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

function Probe() {
  const wishlist = useWishlist();
  return createElement("div", null,
    createElement("div", { "data-testid": "ids" }, wishlist.ids.join(",")),
    createElement("div", { "data-testid": "items" }, wishlist.items.map((item) => `${item.entityType}:${item.entityId}`).join(",")),
    createElement("button", { onClick: () => wishlist.remove("product", 1) }, "remove")
  );
}

describe("WishlistProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes after an optimistic delete when the API responds with a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "DELETE" && url.includes("/api/v1/wishlist/product/1")) {
        return { ok: false, status: 500 } as Response;
      }

      return {
        ok: true,
        json: async () => ({ items: [{ entityType: "product", entityId: 1, name: { ar: "A", en: "A" }, imagePath: null, href: "/products/a", availability: "available" }] })
      } as Response;
    }));

    render(createElement(WishlistProvider, null, createElement(Probe)));

    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("product:1"));

    fireEvent.click(screen.getByRole("button", { name: "remove" }));

    await waitFor(() => expect(screen.getByTestId("ids")).toHaveTextContent("product:1"));
    expect(
      vi.mocked(fetch).mock.calls.some(([url, init]) =>
        String(url).includes("/api/v1/wishlist/product/1") && init?.method === "DELETE")
    ).toBe(true);
  });
});
