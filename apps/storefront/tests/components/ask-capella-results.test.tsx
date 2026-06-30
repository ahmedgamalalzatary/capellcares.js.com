import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict, type Product } from "@capella/shared";

import { AskCapellaReplyContent } from "@/components/ask-capella/ask-capella-results";
import type { AskCapellaResults } from "@/types/ask-capella.types";

const discountedProduct: Product = {
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

const results: AskCapellaResults = {
  products: [discountedProduct],
  categories: [],
  offers: [],
  collections: []
};

describe("AskCapellaReplyContent", () => {
  it("shows the effective discounted price for a product result, not the original price", () => {
    const dict = getDict("en");
    render(
      createElement(AskCapellaReplyContent, {
        results,
        query: "rose",
        lang: "en",
        dict,
        onClose: vi.fn()
      })
    );

    expect(screen.getByText(/EGP\s*100/)).toBeInTheDocument();
    expect(screen.queryByText(/EGP\s*200/)).not.toBeInTheDocument();
  });
});
