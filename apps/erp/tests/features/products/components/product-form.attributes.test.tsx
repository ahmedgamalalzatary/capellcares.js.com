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
  characters: [
    { id: 7, slug: "batman", name: { ar: "باتمان", en: "Batman" } },
    { id: 8, slug: "spiderman", name: { ar: "سبايدرمان", en: "Spiderman" } }
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
  characterIds: [],
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
  it("saves the chosen brand, supplier, age groups and characters", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("الماركة"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("المورد"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "٠-٢ سنة" }));
    fireEvent.click(screen.getByRole("button", { name: "٢-٤ سنة" }));
    fireEvent.click(screen.getByRole("button", { name: "باتمان" }));
    fireEvent.click(screen.getByRole("button", { name: "سبايدرمان" }));
    await save();

    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({
      brandId: 1,
      supplierId: 9,
      ageGroupIds: [3, 4],
      characterIds: [7, 8]
    }));
  });

  it("removes a choice when clicked again", async () => {
    renderForm({ ...initial, characterIds: [7, 8] } as any);
    fireEvent.click(screen.getByRole("button", { name: "باتمان" }));
    await save();
    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ characterIds: [8] }));
  });

  it("blocks publishing without brand, supplier and age group, but allows a draft", async () => {
    renderForm({ ...initial, status: "active" } as any);
    await save();
    expect(upsertProduct).not.toHaveBeenCalled();
    expect(screen.getByText("اختاري الماركة")).toBeInTheDocument();
    expect(screen.getByText("اختاري المورد")).toBeInTheDocument();
    expect(screen.getByText("اختاري فئة عمرية واحدة على الأقل")).toBeInTheDocument();
    cleanup();

    renderForm();
    await save();
    expect(upsertProduct).toHaveBeenCalledTimes(1);
  });

  it("publishes with characters left empty", async () => {
    renderForm({ ...initial, status: "active", brandId: 1, supplierId: 9, ageGroupIds: [3] } as any);
    await save();
    expect(upsertProduct).toHaveBeenCalledWith(expect.objectContaining({ status: "active", characterIds: [] }));
  });
});
