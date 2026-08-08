import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const upsertProduct = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({ upsertProduct })
}));

vi.mock("@/components/forms/editor-form-parts", () => ({
  BilingualEditorField: () => createElement("div"),
  BilingualNameFields: () => createElement("div"),
  ImageFieldCard: ({ children, uploadSlot }: any) => createElement("div", null, children, uploadSlot)
}));

vi.mock("@/components/forms/product-media-upload", () => ({
  ProductMediaUpload: () => createElement("div")
}));

vi.mock("@/components/forms/product-hover-image-upload", () => ({
  ProductHoverImageUpload: () => createElement("div")
}));

vi.mock("@/components/forms/related-items-field", () => ({
  RelatedItemsField: () => createElement("div")
}));

vi.mock("@/components/forms/category-picker", () => ({
  CategoryPicker: () => createElement("div")
}));

vi.mock("@/components/ui/icons", () => ({
  Icon: {
    Plus: () => createElement("span", null, "+"),
    Trash: () => createElement("span", null, "x")
  }
}));

import { ProductForm } from "@/components/forms/product-form";

const KEYWORDS_LABEL = "كلمات مفتاحية (مفصولة بفواصل)";

const initial = {
  id: 1,
  sku: "P1",
  slug: "aloe-vera",
  name: { ar: "لوشن للجسم برائحة الصبار", en: "Aloe Vera" },
  description: { ar: "", en: "" },
  ingredients: { ar: "", en: "" },
  howToUse: { ar: "", en: "" },
  warnings: { ar: "", en: "" },
  keywords: ["lotion", "aloe vera"],
  buyingPrice: 10,
  imagePath: "/uploads/aloe.png",
  hoverImagePath: "",
  media: [{ type: "image" as const, url: "/uploads/aloe.png" }],
  status: "inactive" as const,
  isNew: false,
  isBestseller: false,
  categoryId: 2,
  offerIds: [],
  variants: [{ id: 11, productId: 1, size: "200ml", price: 50, stock: 5, sortOrder: 1, discount: null }],
  createdAt: "",
  updatedAt: "",
  deletedAt: null
};

function renderForm() {
  render(createElement(ProductForm, { mode: "edit" as const, initial: initial as any, categories: [] }));
  return screen.getByLabelText(KEYWORDS_LABEL);
}

afterEach(() => {
  cleanup();
  upsertProduct.mockClear();
});

describe("product form keywords field", () => {
  it("renders a multi-line control so a long list wraps onto the next line", () => {
    const field = renderForm();

    // A single-line <input> scrolls sideways forever; a textarea soft-wraps.
    expect(field.tagName).toBe("TEXTAREA");
  });

  it("still splits the comma-separated list into keywords on save", async () => {
    const field = renderForm();

    fireEvent.change(field, {
      target: { value: "لوشن, لوشن للجسم, تعطير الجسم, lotion, aloe vera, body lotion" }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    });

    expect(upsertProduct).toHaveBeenCalledTimes(1);
    expect(upsertProduct.mock.calls[0]![0].keywords).toEqual([
      "لوشن",
      "لوشن للجسم",
      "تعطير الجسم",
      "lotion",
      "aloe vera",
      "body lotion"
    ]);
  });

  it("splits keywords written on separate lines, since a textarea invites Enter", async () => {
    const field = renderForm();

    fireEvent.change(field, { target: { value: "لوشن\nbody lotion, aloe vera\n\nترطيب" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    });

    expect(upsertProduct.mock.calls[0]![0].keywords).toEqual([
      "لوشن",
      "body lotion",
      "aloe vera",
      "ترطيب"
    ]);
  });
});
