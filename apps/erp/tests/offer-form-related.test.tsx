import { createElement } from "react";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const upsertOffer = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/lib/api/client", () => ({
  API_BASE: "",
  api: {
    uploadImage: vi.fn(),
    uploadMedia: vi.fn()
  }
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({ upsertOffer })
}));

vi.mock("@/components/forms/entity-media-upload", () => ({
  EntityMediaUpload: ({ value, onChange }: any) => createElement(
    "button",
    {
      type: "button",
      "data-testid": "offer-media-upload",
      onClick: () => onChange([
        ...value,
        { type: "image", url: "/uploads/offer-detail.png" },
        { type: "video", url: "/uploads/offer-demo.mp4" }
      ])
    },
    "add offer media"
  )
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
    media: [{ type: "image" as const, url: "/uploads/offer.png" }],
    price: 80,
    originalTotal: 100,
    items: [{ variantId: 1, qty: 1 }],
    stock: 3,
    status: "active" as const,
    categoryId: 5,
    visibility: "visible" as const,
    createdAt: "",
    updatedAt: ""
  };
}

const categories = [
  { id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }
];

describe("OfferForm related items", () => {
  it("saves the ordered offer media gallery", async () => {
    upsertOffer.mockClear();
    const view = render(
      createElement(OfferForm, { mode: "edit", initial: completeOffer(1), products, categories, relatedOptions })
    );
    const form = within(view.container);

    fireEvent.click(form.getByTestId("offer-media-upload"));
    fireEvent.click(form.getByRole("button", { name: /حفظ التعديلات/ }));

    await waitFor(() => {
      expect(upsertOffer).toHaveBeenCalledWith(expect.objectContaining({
        imagePath: "/uploads/offer.png",
        media: [
          { type: "image", url: "/uploads/offer.png" },
          { type: "image", url: "/uploads/offer-detail.png" },
          { type: "video", url: "/uploads/offer-demo.mp4" }
        ]
      }));
    });
  });

  it("renders the related-items selector", () => {
    const view = render(createElement(OfferForm, { mode: "new", products, categories, relatedOptions }));
    const form = within(view.container);
    expect(form.getByTestId("related-items-field")).toBeInTheDocument();
    expect(form.getByTestId("related-items-add")).toBeInTheDocument();
  });

  it("excludes the current offer from its own related options", () => {
    const view = render(
      createElement(OfferForm, { mode: "edit", initial: completeOffer(1), products, categories, relatedOptions })
    );
    const select = within(view.container).getByTestId("related-items-add") as HTMLSelectElement;
    const values = Array.from(select.querySelectorAll("option")).map((option) => option.value);
    expect(values).not.toContain("offer:1");
    expect(values).toContain("offer:2");
    expect(values).toContain("product:10");
  });

  it("saves the selected related items in the chosen order", async () => {
    const view = render(
      createElement(OfferForm, { mode: "edit", initial: completeOffer(1), products, categories, relatedOptions })
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

  it("preserves existing offer item ids when saving an edited offer", async () => {
    upsertOffer.mockClear();
    const view = render(
      createElement(OfferForm, {
        mode: "edit",
        initial: {
          ...completeOffer(1),
          items: [{ id: 77, variantId: 1, qty: 1 }]
        } as any,
        products,
        categories,
        relatedOptions
      })
    );
    const form = within(view.container);

    fireEvent.change(form.getByDisplayValue("1"), { target: { value: "3" } });
    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ id: 77, variantId: 1, qty: 3 }]
        })
      );
    });
  });
});
