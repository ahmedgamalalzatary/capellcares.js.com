import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { WishlistView } from "@/components/wishlist/WishlistView";
import type { StorefrontProduct } from "@/lib/products";

function makeProduct(id: number, slug: string, en: string): StorefrontProduct {
  return {
    id,
    slug,
    name: { ar: en, en },
    keywords: [], imagePath: "/p.png", media: [], status: "active", isNew: false, isBestseller: false,
    sizes: [{ id: 1, label: "S", sortOrder: 1 }],
    colors: [],
    variants: [{ id: id * 100, sizeId: 1, colorId: null, price: 10, stock: 1 }]
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("WishlistView", () => {
  it("renders only the wishlisted products from the catalog", async () => {
    localStorage.setItem("minikoshk_wishlist", JSON.stringify([1]));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      items: [makeProduct(1, "kept", "Kept product"), makeProduct(2, "other", "Other product")]
    })));

    render(<LocaleProvider lang="en"><WishlistView /></LocaleProvider>);

    expect(await screen.findByText("Kept product")).toBeInTheDocument();
    expect(screen.queryByText("Other product")).not.toBeInTheDocument();
  });

  it("shows the empty state with a link back to the catalog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ items: [] })));

    render(<LocaleProvider lang="en"><WishlistView /></LocaleProvider>);

    expect(await screen.findByText("Your wishlist is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute("href", "/en/products");
  });
});
