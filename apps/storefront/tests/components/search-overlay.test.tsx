import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

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
    fetchProducts: vi.fn().mockResolvedValue([discountedProduct])
  };
});

import { SearchOverlay } from "@/components/layout/header/search-overlay";

describe("SearchOverlay", () => {
  it("shows the effective discounted price in search results, not the original price", async () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn() }));

    fireEvent.change(screen.getByPlaceholderText(dict.nav.search), { target: { value: "rose" } });

    expect(await screen.findByText(/EGP\s*100/)).toBeInTheDocument();
    expect(screen.queryByText(/EGP\s*200/)).not.toBeInTheDocument();
  });
});
