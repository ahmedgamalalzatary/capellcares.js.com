import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const upsertProduct = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/store", () => ({
  getStore: () => ({ upsertProduct })
}));

import { normalizeProduct } from "@/lib/store/normalizers";
import { useProductForm } from "@/features/products/hooks/use-product-form";

afterEach(() => {
  cleanup();
  upsertProduct.mockClear();
});

describe("product hover image through normalization", () => {
  it("keeps an explicitly cleared English hover image clear through normalize + form save", async () => {
    // Mirrors the admin API's localized read for an Arabic-only hover image:
    // the legacy field falls back to Arabic, the English field is explicitly null.
    const apiResponse = {
      id: 3,
      sku: "SKU-3",
      slug: "arabic-only-product",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/product-ar.jpg",
      hoverImagePath: "/uploads/product-hover-ar.jpg",
      arHoverImagePath: "/uploads/product-hover-ar.jpg",
      enHoverImagePath: null,
      media: [],
      status: "inactive",
      isNew: false,
      isBestseller: false,
      categoryId: 2,
      variants: [{ id: 31, productId: 3, sizeLabel: "100ml", sellingPrice: 50, stockQty: 5, sortOrder: 1 }],
      createdAt: "",
      updatedAt: "",
      deletedAt: null
    } as any;

    const normalized = normalizeProduct(apiResponse);
    const { result } = renderHook(() => useProductForm({ initial: normalized }));

    expect(result.current.arHoverImagePath).toBe("/uploads/product-hover-ar.jpg");
    expect(result.current.enHoverImagePath).toBe("");

    await act(async () => {
      await result.current.save();
    });

    const payload = upsertProduct.mock.calls[0]?.[0];
    expect(payload.hoverImagePath).toBe("");
    expect(payload.arHoverImagePath).toBe("/uploads/product-hover-ar.jpg");
    expect(payload.enHoverImagePath).toBe(null);
  });

  it("still seeds English from the legacy field when the API omits the localized field", async () => {
    const apiResponse = {
      id: 4,
      sku: "SKU-4",
      slug: "legacy-hover-product",
      name: { ar: "منتج", en: "Product" },
      description: { ar: "", en: "" },
      ingredients: { ar: "", en: "" },
      howToUse: { ar: "", en: "" },
      warnings: { ar: "", en: "" },
      keywords: [],
      buyingPrice: 10,
      imagePath: "/uploads/product.jpg",
      hoverImagePath: "/uploads/product-hover-legacy.jpg",
      media: [],
      status: "inactive",
      isNew: false,
      isBestseller: false,
      categoryId: 2,
      variants: [{ id: 41, productId: 4, sizeLabel: "100ml", sellingPrice: 50, stockQty: 5, sortOrder: 1 }],
      createdAt: "",
      updatedAt: "",
      deletedAt: null
    } as any;

    const normalized = normalizeProduct(apiResponse);
    const { result } = renderHook(() => useProductForm({ initial: normalized }));

    expect(result.current.enHoverImagePath).toBe("/uploads/product-hover-legacy.jpg");

    await act(async () => {
      await result.current.save();
    });

    const payload = upsertProduct.mock.calls[0]?.[0];
    expect(payload.hoverImagePath).toBe("/uploads/product-hover-legacy.jpg");
    expect(payload.enHoverImagePath).toBe("/uploads/product-hover-legacy.jpg");
  });
});

describe("product slug on save", () => {
  it("leaves the slug empty for an Arabic-only draft so digits in the Arabic name never become the link", async () => {
    const { result } = renderHook(() => useProductForm({}));

    act(() => {
      result.current.setNameAr("منتج 2");
    });
    await act(async () => {
      await result.current.save({ asStatus: "inactive" });
    });

    expect(upsertProduct.mock.calls[0]?.[0].slug).toBe("");
  });
});
