import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertProduct = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/store", () => ({ getStore: () => ({ upsertProduct }) }));
vi.mock("@/components/forms/editor-form-parts", () => ({
  BilingualEditorField: () => createElement("div"),
  BilingualNameFields: () => createElement("div")
}));
vi.mock("@/components/forms/entity-media-upload", () => ({
  ProductMediaUpload: () => createElement("div"),
  EntityMediaUpload: () => createElement("div")
}));
vi.mock("@/components/forms/related-items-field", () => ({ RelatedItemsField: () => createElement("div") }));
vi.mock("@/components/forms/category-picker", () => ({ CategoryPicker: () => createElement("div") }));

import { ProductForm } from "@/features/products/components/product-form";

const attributes = { brands: [], genders: [], ageGroups: [], suppliers: [{ id: 9, name: "Supplier 1" }] };

const base = {
  id: 1,
  sku: "P1",
  slug: "toy",
  name: { ar: "لعبة", en: "Toy" },
  description: { ar: "", en: "" },
  ingredients: { ar: "", en: "" },
  howToUse: { ar: "", en: "" },
  warnings: { ar: "", en: "" },
  keywords: ["toy"],
  buyingPrice: 10,
  imagePath: "/uploads/toy.png",
  hoverImagePath: "",
  media: [{ type: "image" as const, arUrl: null, enUrl: "/uploads/toy.png" }],
  status: "inactive" as const,
  isNew: false,
  isBestseller: false,
  categoryId: 2,
  brandId: null,
  supplierId: 9,
  ageGroupIds: [],
  offerIds: [],
  colors: [],
  variants: [{ id: 11, productId: 1, size: "One", colorId: null, price: 50, stock: 5, sortOrder: 1, discount: null }],
  createdAt: "",
  updatedAt: ""
};

const coloured = {
  ...base,
  colors: [
    { id: 7, name: { ar: "أسود", en: "Black" }, hex: "#000000", media: [] },
    { id: 8, name: { ar: "", en: "" }, hex: "#0000ff", media: [] }
  ],
  variants: [
    { id: 21, productId: 1, size: "S", colorId: 7, price: 100, stock: 3, sortOrder: 1, discount: null },
    { id: 22, productId: 1, size: "S", colorId: 8, price: 100, stock: 0, sortOrder: 2, discount: null },
    { id: 23, productId: 1, size: "M", colorId: 7, price: 150, stock: 5, sortOrder: 3, discount: null },
    { id: 24, productId: 1, size: "M", colorId: 8, price: 150, stock: 2, sortOrder: 4, discount: null }
  ]
};

function openPricing(product: unknown) {
  render(createElement(ProductForm, { mode: "edit", initial: product, categories: [], attributes } as any));
  fireEvent.click(screen.getByRole("button", { name: /المقاسات والأسعار/ }));
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  });
}

function payload() {
  return upsertProduct.mock.calls[0]?.[0];
}

beforeEach(() => upsertProduct.mockClear());
afterEach(cleanup);

describe("ProductForm sizes and colours", () => {
  it("keeps the stock and the stored variant when the first colour is added", async () => {
    openPricing(base);
    fireEvent.click(screen.getByRole("button", { name: /إضافة لون/ }));
    fireEvent.change(screen.getByPlaceholderText("مثال: أحمر"), { target: { value: "أحمر" } });
    await save();

    const { colors, variants } = payload();
    expect(colors).toHaveLength(1);
    expect(colors[0]).toMatchObject({ name: { ar: "أحمر", en: "" }, hex: null });
    expect(variants).toEqual([expect.objectContaining({ id: 11, size: "One", colorId: colors[0].id, price: 50, stock: 5 })]);
  });

  it("prices every colour of a size by that size", async () => {
    openPricing(coloured);
    fireEvent.change(screen.getAllByLabelText("سعر البيع")[1]!, { target: { value: "175" } });
    await save();

    const { variants } = payload();
    expect(variants.map((v: any) => [v.id, v.size, v.colorId, v.price, v.stock])).toEqual([
      [21, "S", 7, 100, 3], [22, "S", 8, 100, 0], [23, "M", 7, 175, 5], [24, "M", 8, 175, 2]
    ]);
  });

  it("drops a removed colour's variants", async () => {
    openPricing(coloured);
    fireEvent.click(screen.getAllByRole("button", { name: "حذف اللون #0000ff" })[0]!);
    await save();

    const { colors, variants } = payload();
    expect(colors.map((color: any) => color.id)).toEqual([7]);
    expect(variants.map((v: any) => v.id)).toEqual([21, 23]);
  });

  it("will not save a colour that is neither picked nor named", async () => {
    openPricing(base);
    fireEvent.click(screen.getByRole("button", { name: /إضافة لون/ }));
    await save();

    expect(upsertProduct).not.toHaveBeenCalled();
    expect(screen.getByText("اختاري لونًا من اللوحة أو اكتبي اسمه لكل لون")).toBeInTheDocument();
  });

  it("saves a product without sizes as one unnamed size", async () => {
    openPricing({ ...base, variants: [{ ...base.variants[0], size: "" }] });
    await save();
    expect(payload().variants).toEqual([expect.objectContaining({ id: 11, size: "", colorId: null })]);
  });
});
