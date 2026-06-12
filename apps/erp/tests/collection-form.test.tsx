import { createElement } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push
  })
}));

vi.mock("@/lib/store", () => ({
  getStore: () => ({
    upsertCollection: vi.fn().mockResolvedValue(undefined)
  })
}));

vi.mock("@/components/forms/editor-form-parts", () => ({
  BilingualEditorField: () => createElement("div"),
  BilingualNameFields: () => createElement("div"),
  EditorActions: () => createElement("div"),
  ImageFieldCard: ({ children, uploadSlot }: any) => createElement("div", null, children, uploadSlot)
}));

vi.mock("@/components/forms/image-upload", () => ({
  ImageUpload: () => createElement("div")
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

import { CollectionForm } from "@/components/forms/collection-form";
import { useCollectionForm } from "@/hooks/forms/use-collection-form";

describe("CollectionForm", () => {
  it("lists descendant-category products when the selected category is a parent", () => {
    render(createElement(CollectionForm, {
      mode: "new",
      initial: {
        id: 1,
        slug: "parent-collection",
        name: { ar: "مجموعة", en: "Collection" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/collection.png",
        price: 100,
        originalTotal: 0,
        categoryId: 1,
        items: [{ variantId: 11, qty: 1 }],
        stock: 0,
        status: "active",
        visibility: "visible",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      },
      categories: [
        { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, deletedAt: null },
        { id: 2, parentId: 1, slug: "skin-cream", name: { ar: "كريمات", en: "Creams" }, isLeaf: false, deletedAt: null },
        { id: 3, parentId: 2, slug: "dry-skin", name: { ar: "بشرة جافة", en: "Dry Skin" }, isLeaf: true, deletedAt: null }
      ],
      products: [
        {
          id: 10,
          sku: "P10",
          slug: "child-product",
          name: { ar: "غسول", en: "Cleanser" },
          description: { ar: "", en: "" },
          ingredients: { ar: "", en: "" },
          howToUse: { ar: "", en: "" },
          warnings: { ar: "", en: "" },
          keywords: [],
          buyingPrice: 10,
          imagePath: "",
          media: [],
          hoverImagePath: "",
          status: "active",
          isNew: false,
          isBestseller: false,
          categoryId: 3,
          deletedAt: null,
          variants: [{ id: 11, productId: 10, size: "100ml", price: 50, stock: 5, sortOrder: 1 }],
          createdAt: "",
          updatedAt: ""
        }
      ]
    }));

    fireEvent.click(screen.getByRole("button", { name: /إضافة منتج/ }));

    const productSelects = screen.getAllByRole("combobox");
    const rowProductSelect = productSelects[productSelects.length - 2]!;

    expect(screen.getAllByRole("option", { name: "غسول" })).toHaveLength(2);
    fireEvent.change(rowProductSelect, { target: { value: "10" } });
    expect((rowProductSelect as HTMLSelectElement).value).toBe("10");
  });

  it("reports that collection items must stay in the selected category tree", async () => {
    const { result } = renderHook(() => useCollectionForm({
      mode: "edit",
      initial: {
        id: 1,
        slug: "mixed-collection",
        name: { ar: "مجموعة", en: "Collection" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/collection.png",
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
      categories: [
        { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, deletedAt: null },
        { id: 2, parentId: 1, slug: "skin-cream", name: { ar: "كريمات", en: "Creams" }, isLeaf: true, deletedAt: null },
        { id: 3, parentId: null, slug: "hair-care", name: { ar: "العناية بالشعر", en: "Hair Care" }, isLeaf: true, deletedAt: null }
      ],
      products: [
        {
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
          status: "active",
          isNew: false,
          isBestseller: false,
          categoryId: 2,
          deletedAt: null,
          variants: [{ id: 11, productId: 10, size: "100ml", price: 50, stock: 5, sortOrder: 1 }],
          createdAt: "",
          updatedAt: ""
        },
        {
          id: 20,
          sku: "P20",
          slug: "hair-product",
          name: { ar: "زيت شعر", en: "Hair Oil" },
          description: { ar: "", en: "" },
          ingredients: { ar: "", en: "" },
          howToUse: { ar: "", en: "" },
          warnings: { ar: "", en: "" },
          keywords: [],
          buyingPrice: 12,
          imagePath: "/uploads/hair.png",
          media: [],
          hoverImagePath: "",
          status: "active",
          isNew: false,
          isBestseller: false,
          categoryId: 3,
          deletedAt: null,
          variants: [{ id: 21, productId: 20, size: "100ml", price: 60, stock: 5, sortOrder: 1 }],
          createdAt: "",
          updatedAt: ""
        }
      ]
    }));

    await act(async () => {
      const saved = await result.current.save();
      expect(saved).toBe(false);
    });

    expect(result.current.errors.rows).toBe("كل العناصر يجب أن تنتمي إلى القسم المختار أو أقسامه الفرعية");
  });
});
