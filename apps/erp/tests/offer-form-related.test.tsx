import { createElement } from "react";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const upsertOffer = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/lib/api/client", () => ({
  api: {
    uploadImage: vi.fn(),
    uploadMedia: vi.fn()
  }
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({ upsertOffer })
}));

import { OfferForm } from "@/components/forms/offer-form";

const products = [
  {
    id: 10,
    sku: "P10",
    slug: "p10",
    name: { ar: "منتج باقة", en: "Bundle Product" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 10,
    imagePath: "",
    media: [],
    status: "active" as const,
    isNew: false,
    isBestseller: false,
    categoryId: 5,
    variants: [{ id: 1, productId: 10, size: "100ml", price: 50, stock: 5, sortOrder: 1 }],
    createdAt: "",
    updatedAt: ""
  }
];

const relatedOptions = [
  { type: "offer" as const, id: 1, name: { ar: "العرض الحالي", en: "Current Offer" }, slug: "offer-1" },
  { type: "offer" as const, id: 2, name: { ar: "عرض آخر", en: "Other Offer" }, slug: "offer-2" },
  { type: "product" as const, id: 10, name: { ar: "منتج باقة", en: "Bundle Product" }, slug: "p10" }
];

function completeOffer(id: number) {
  return {
    id,
    slug: `offer-${id}`,
    name: { ar: "عرض", en: "Offer" },
    description: { ar: "وصف", en: "Description" },
    imagePath: "/uploads/offer.png",
    price: 80,
    originalTotal: 100,
    items: [{ variantId: 1, qty: 1 }],
    stock: 3,
    status: "active" as const,
    createdAt: "",
    updatedAt: ""
  };
}

describe("OfferForm related items", () => {
  it("renders the related-items selector", () => {
    const view = render(createElement(OfferForm, { mode: "new", products, relatedOptions }));
    const form = within(view.container);
    expect(form.getByTestId("related-items-field")).toBeInTheDocument();
    expect(form.getByTestId("related-items-add")).toBeInTheDocument();
  });

  it("excludes the current offer from its own related options", () => {
    const view = render(
      createElement(OfferForm, { mode: "edit", initial: completeOffer(1), products, relatedOptions })
    );
    const select = within(view.container).getByTestId("related-items-add") as HTMLSelectElement;
    const values = Array.from(select.querySelectorAll("option")).map((option) => option.value);
    expect(values).not.toContain("offer:1");
    expect(values).toContain("offer:2");
    expect(values).toContain("product:10");
  });

  it("saves the selected related items in the chosen order", async () => {
    const view = render(
      createElement(OfferForm, { mode: "edit", initial: completeOffer(1), products, relatedOptions })
    );
    const form = within(view.container);

    fireEvent.change(form.getByTestId("related-items-add"), { target: { value: "product:10" } });
    fireEvent.change(form.getByTestId("related-items-add"), { target: { value: "offer:2" } });

    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          relatedItems: [
            { type: "product", id: 10 },
            { type: "offer", id: 2 }
          ]
        })
      );
    });
  });
});
