import { createElement } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    upsertOffer: vi.fn().mockResolvedValue(undefined)
  })
}));

vi.mock("@/components/forms/editor-form-parts", () => ({
  BilingualEditorField: () => createElement("div"),
  BilingualNameFields: () => createElement("div"),
  EditorActions: () => createElement("div"),
  ImageFieldCard: ({ children, uploadSlot }: any) => createElement("div", null, children, uploadSlot)
}));

vi.mock("@/components/forms/entity-media-upload", () => ({
  EntityMediaUpload: () => createElement("div")
}));

vi.mock("@/components/forms/related-items-field", () => ({
  RelatedItemsField: () => createElement("div")
}));

vi.mock("@/components/ui/icons", () => ({
  Icon: {
    Plus: () => createElement("span", null, "+"),
    Trash: () => createElement("span", null, "x"),
    Chevron: () => createElement("span", null, "^")
  }
}));

import { OfferForm } from "@/components/forms/offer-form";
import { useOfferForm } from "@/hooks/forms/use-offer-form";

const skinProduct = {
  id: 10,
  sku: "P10",
  slug: "skin-product",
  name: { ar: "غسول", en: "Cleanser" },
  description: { ar: "", en: "" },
  ingredients: { ar: "", en: "" },
  howToUse: { ar: "", en: "" },
  warnings: { ar: "", en: "" },
  keywords: [],
  buyingPrice: 10,
  imagePath: "/uploads/skin.png",
  media: [],
  hoverImagePath: "",
  status: "active" as const,
  isNew: false,
  isBestseller: false,
  categoryId: 2,
  deletedAt: null,
  variants: [{ id: 11, productId: 10, size: "100ml", price: 50, stock: 5, sortOrder: 1 }],
  createdAt: "",
  updatedAt: ""
};

const hairProduct = {
  ...skinProduct,
  id: 20,
  sku: "P20",
  slug: "hair-product",
  name: { ar: "زيت شعر", en: "Hair Oil" },
  imagePath: "/uploads/hair.png",
  categoryId: 3,
  variants: [{ id: 21, productId: 20, size: "100ml", price: 60, stock: 5, sortOrder: 1 }]
};

const categories = [
  { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, deletedAt: null },
  { id: 2, parentId: 1, slug: "skin-cream", name: { ar: "كريمات", en: "Creams" }, isLeaf: true, deletedAt: null },
  { id: 3, parentId: null, slug: "hair-care", name: { ar: "العناية بالشعر", en: "Hair Care" }, isLeaf: true, deletedAt: null }
];

afterEach(() => {
  cleanup();
});

describe("OfferForm category", () => {
  it("only offers root categories for the offer category", () => {
    render(createElement(OfferForm, {
      mode: "new",
      categories,
      products: []
    } as any));

    const categorySelect = screen.getByLabelText("القسم");

    expect(categorySelect).toHaveDisplayValue("— اختاري —");
    expect(screen.getByRole("option", { name: "العناية بالبشرة" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "العناية بالشعر" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "كريمات" })).not.toBeInTheDocument();
  });

  it("lists only products inside the selected category tree", () => {
    render(createElement(OfferForm, {
      mode: "new",
      categories,
      products: [skinProduct, hairProduct]
    } as any));

    fireEvent.change(screen.getByLabelText("القسم"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /إضافة منتج/ }));

    expect(screen.getByRole("option", { name: "غسول" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "زيت شعر" })).not.toBeInTheDocument();
  });

  it("requires a category before an offer can be saved", async () => {
    const { result } = renderHook(() => useOfferForm({
      mode: "new",
      categories,
      products: [skinProduct]
    } as any));

    await act(async () => {
      const saved = await result.current.save();
      expect(saved).toBe(false);
    });

    expect(result.current.errors.categoryId).toBe("اختاري القسم");
  });

  it("reports that offer items must stay in the selected category tree", async () => {
    const { result } = renderHook(() => useOfferForm({
      mode: "edit",
      initial: {
        id: 1,
        slug: "mixed-offer",
        name: { ar: "عرض", en: "Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/offer.png",
        media: [{ type: "image", url: "/uploads/offer.png" }],
        price: 100,
        originalTotal: 110,
        categoryId: 1,
        items: [
          { id: 1, variantId: 11, qty: 1 },
          { id: 2, variantId: 21, qty: 1 }
        ],
        stock: 0,
        status: "active",
        visibility: "visible",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      },
      categories,
      products: [skinProduct, hairProduct]
    } as any));

    await act(async () => {
      const saved = await result.current.save();
      expect(saved).toBe(false);
    });

    expect(result.current.errors.rows).toBe("كل العناصر يجب أن تنتمي إلى القسم المختار أو أقسامه الفرعية");
  });
});

describe("OfferForm legacy offer with no category", () => {
  it("still shows the existing items' products so they do not read as unselected", () => {
    render(createElement(OfferForm, {
      mode: "edit",
      initial: {
        id: 1,
        slug: "legacy-offer",
        name: { ar: "عرض قديم", en: "Legacy Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/offer.png",
        media: [{ type: "image", url: "/uploads/offer.png" }],
        price: 100,
        originalTotal: 110,
        categoryId: null,
        items: [{ id: 1, variantId: 11, qty: 1 }],
        stock: 0,
        status: "inactive",
        visibility: "visible",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      },
      categories,
      products: [skinProduct, hairProduct]
    } as any));

    const row = screen.getAllByTestId("bundle-item-row")[0]!;
    const productSelect = within(row).getAllByRole("combobox")[0]! as HTMLSelectElement;
    expect(productSelect.value).toBe("10");
  });
});

