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
vi.mock("@/components/forms/entity-media-upload", () => ({ ProductMediaUpload: () => createElement("div") }));
vi.mock("@/components/forms/related-items-field", () => ({ RelatedItemsField: () => createElement("div") }));
vi.mock("@/components/forms/category-picker", () => ({ CategoryPicker: () => createElement("div") }));

import { ProductForm } from "@/features/products/components/product-form";

const attributes = {
  brands: [{ id: 1, slug: "lego", name: { ar: "ليجو", en: "LEGO" } }],
  genders: [
    { id: 5, slug: "girls", name: { ar: "بنات", en: "Girls" } },
    { id: 6, slug: "boys", name: { ar: "أولاد", en: "Boys" } }
  ],
  ageGroups: [
    { id: 3, slug: "0-2", name: { ar: "٠-٢ سنة", en: "0-2" } },
    { id: 4, slug: "2-4", name: { ar: "٢-٤ سنة", en: "2-4" } }
  ],
  suppliers: [{ id: 9, name: "Supplier 1" }]
};

const initial = {
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
  supplierId: null,
  ageGroupIds: [],
  offerIds: [],
  variants: [{ id: 11, productId: 1, size: "One", price: 50, stock: 5, sortOrder: 1, discount: null }],
  createdAt: "",
  updatedAt: ""
};

function renderForm(product = initial) {
  render(createElement(ProductForm, { mode: "edit", initial: product, categories: [], attributes } as any));
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
  });
}

beforeEach(() => upsertProduct.mockClear());
afterEach(cleanup);

describe("ProductForm attributes", () => {
  it("saves the chosen brand, supplier and age groups", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("الماركة (اختياري)"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("المورد"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "٠-٢ سنة" }));
    fireEvent.click(screen.getByRole("button", { name: "٢-٤ سنة" }));
    await save();

    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ brandId: 1, supplierId: 9, ageGroupIds: [3, 4] }));
  });

  it("saves one or several genders, and publishes with none", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "بنات" }));
    fireEvent.click(screen.getByRole("button", { name: "أولاد" }));
    await save();
    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ genderIds: [5, 6] }));
    cleanup();
    upsertProduct.mockClear();

    renderForm({ ...initial, status: "active", brandId: 1, supplierId: 9 } as any);
    await save();
    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ status: "active", genderIds: [] }));
  });

  it("removes a choice when clicked again", async () => {
    renderForm({ ...initial, ageGroupIds: [3, 4] } as any);
    fireEvent.click(screen.getByRole("button", { name: "٠-٢ سنة" }));
    await save();
    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ ageGroupIds: [4] }));
  });

  it("has no character field", () => {
    renderForm();
    expect(screen.queryByText(/الشخصيات/)).toBeNull();
  });

  it("publishes without a brand", async () => {
    renderForm({ ...initial, status: "active", supplierId: 9 } as any);
    await save();
    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ status: "active", brandId: null }));
  });

  it("publishes with no age group chosen", async () => {
    renderForm({ ...initial, status: "active", brandId: 1, supplierId: 9 } as any);
    await save();
    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ status: "active", ageGroupIds: [] }));
  });

  it("still needs a supplier to publish, but not for a draft", async () => {
    renderForm({ ...initial, status: "active" } as any);
    await save();
    expect(upsertProduct).not.toHaveBeenCalled();
    expect(screen.getByText("اختاري المورد")).toBeInTheDocument();
    cleanup();

    renderForm();
    await save();
    expect(upsertProduct).toHaveBeenCalledTimes(1);
  });
});
