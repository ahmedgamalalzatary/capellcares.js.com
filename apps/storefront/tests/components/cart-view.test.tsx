import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDict } from "@capella/shared";

vi.mock("@/lib/api/client", () => {
  const discountedProduct = {
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
    variants: [
      {
        id: 11,
        productId: 1,
        size: "30ml",
        price: 200,
        stock: 4,
        discount: {
          type: "percentage",
          value: 50,
          startsAt: "2000-01-01T00:00:00.000Z",
          endsAt: "2999-01-01T00:00:00.000Z",
          status: "active"
        }
      }
    ],
    createdAt: "",
    updatedAt: ""
  };

  return {
    fetchProducts: vi.fn().mockResolvedValue([discountedProduct]),
    fetchOffers: vi.fn().mockResolvedValue([]),
    fetchCollections: vi.fn().mockResolvedValue([])
  };
});

import { saveCartLines, clearCartLines } from "@/lib/cart";
import { CartProvider } from "@/components/providers/cart-provider";
import { CartView } from "@/components/cart/cart-view";

describe("CartView", () => {
  beforeEach(() => {
    clearCartLines(window.localStorage);
  });

  it("prices a discounted product line at the effective discounted price, not the original price", async () => {
    saveCartLines(window.localStorage, [{ type: "product", productId: 1, variantId: 11, qty: 2 }]);

    const dict = getDict("en");
    render(createElement(CartProvider, null, createElement(CartView, { lang: "en", dict })));

    // Discounted unit price is 100 (50% off 200), qty 2 -> line total 200, not 400.
    expect((await screen.findAllByText(/EGP\s*200/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/EGP\s*400/)).not.toBeInTheDocument();
  });
});
