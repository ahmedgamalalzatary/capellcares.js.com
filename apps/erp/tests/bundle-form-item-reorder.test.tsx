import { createElement } from "react";
import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const upsertOffer = vi.fn().mockResolvedValue(undefined);
const upsertCollection = vi.fn().mockResolvedValue(undefined);

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
  getStore: () => ({ upsertOffer, upsertCollection })
}));

import { OfferForm } from "@/components/forms/offer-form";
import { CollectionForm } from "@/components/forms/collection-form";

function makeProduct(id: number, variantId: number) {
  return {
    id,
    sku: `P${id}`,
    slug: `p${id}`,
    name: { ar: `منتج ${id}`, en: `Product ${id}` },
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
    variants: [{ id: variantId, productId: id, size: "100ml", price: 50, stock: 5, sortOrder: 1 }],
    createdAt: "",
    updatedAt: ""
  };
}

const products = [makeProduct(10, 1), makeProduct(20, 2)];

const offerInitial = {
  id: 1,
  slug: "offer-1",
  name: { ar: "عرض", en: "Offer" },
  description: { ar: "وصف", en: "Description" },
  imagePath: "/uploads/offer.png",
  price: 80,
  originalTotal: 100,
  items: [
    { id: 100, variantId: 1, qty: 1 },
    { id: 101, variantId: 2, qty: 1 }
  ],
  stock: 3,
  status: "active" as const,
  categoryId: 5,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

const collectionInitial = {
  ...offerInitial,
  slug: "collection-1",
  name: { ar: "مجموعة", en: "Collection" }
};

const categories = [
  { id: 5, parentId: null, slug: "cat", name: { ar: "قسم", en: "Category" }, isLeaf: true }
];

describe("bundle form item ordering", () => {
  it("edits and saves an offer YouTube URL", async () => {
    upsertOffer.mockClear();
    const view = render(createElement(OfferForm, { mode: "edit", initial: offerInitial, products, categories }));
    const form = within(view.container);

    fireEvent.change(form.getByLabelText("رابط فيديو يوتيوب (اختياري)"), {
      target: { value: " https://www.youtube.com/watch?v=offer " }
    });
    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertOffer).toHaveBeenCalledWith(expect.objectContaining({
        youtubeUrl: "https://www.youtube.com/watch?v=offer"
      }));
    });
  });

  it("edits and saves a collection YouTube URL", async () => {
    upsertCollection.mockClear();
    const view = render(
      createElement(CollectionForm, { mode: "edit", initial: collectionInitial, products, categories })
    );
    const form = within(view.container);

    fireEvent.change(form.getByLabelText("رابط فيديو يوتيوب (اختياري)"), {
      target: { value: " https://www.youtube.com/watch?v=collection " }
    });
    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertCollection).toHaveBeenCalledWith(expect.objectContaining({
        youtubeUrl: "https://www.youtube.com/watch?v=collection"
      }));
    });
  });

  it("moves an offer item up and saves items in the new order", async () => {
    const view = render(createElement(OfferForm, { mode: "edit", initial: offerInitial, products, categories }));
    const form = within(view.container);

    const rows = form.getAllByTestId("bundle-item-row");
    fireEvent.click(within(rows[1]!).getByRole("button", { name: "تحريك لأعلى" }));

    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertOffer).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            { id: 101, variantId: 2, qty: 1 },
            { id: 100, variantId: 1, qty: 1 }
          ]
        })
      );
    });
  });

  it("moves a collection item up and saves items in the new order", async () => {
    const view = render(
      createElement(CollectionForm, { mode: "edit", initial: collectionInitial, products, categories })
    );
    const form = within(view.container);

    const rows = form.getAllByTestId("bundle-item-row");
    fireEvent.click(within(rows[1]!).getByRole("button", { name: "تحريك لأعلى" }));

    fireEvent.click(form.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(upsertCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            { id: 101, variantId: 2, qty: 1 },
            { id: 100, variantId: 1, qty: 1 }
          ]
        })
      );
    });
  });
});
