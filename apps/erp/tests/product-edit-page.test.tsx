import { createElement, Suspense } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

import { buildRelatedOptions } from "@/components/forms/related-options";

const apiGet = vi.fn();

vi.mock("@/lib/api/client", () => ({
  api: { get: (path: string) => apiGet(path) }
}));

vi.mock("@/components/shell/admin-shell", () => ({
  AdminShell: ({ children }: any) => createElement("div", null, children)
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  }
}));

let capturedProps: any = null;
vi.mock("@/components/forms/product-form", () => ({
  ProductForm: (props: any) => {
    capturedProps = props;
    return createElement("div", { "data-testid": "product-form" });
  }
}));

const storeState = {
  products: [
    {
      id: 1,
      sku: "P1",
      slug: "product-1",
      name: { ar: "منتج", en: "Product 1" },
      status: "active",
      deletedAt: null,
      variants: []
    },
    {
      id: 2,
      sku: "P2",
      slug: "product-2",
      name: { ar: "منتج٢", en: "Product 2" },
      status: "active",
      deletedAt: null,
      variants: []
    }
  ],
  offers: [
    { id: 9, slug: "offer-9", name: { ar: "عرض", en: "Offer 9" }, status: "active", deletedAt: null }
  ],
  categories: [],
  loaded: true,
  error: null
};

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(storeState)
}));

import EditProductPage from "@/app/products/[id]/edit/page";

describe("buildRelatedOptions", () => {
  it("includes active, non-deleted products and offers and drops the rest", () => {
    const options = buildRelatedOptions(
      [
        { id: 1, slug: "a", name: { ar: "أ", en: "A" }, status: "active", deletedAt: null } as any,
        { id: 2, slug: "b", name: { ar: "ب", en: "B" }, status: "inactive", deletedAt: null } as any,
        { id: 3, slug: "c", name: { ar: "ج", en: "C" }, status: "active", deletedAt: "2026-01-01" } as any
      ],
      [{ id: 7, slug: "o", name: { ar: "د", en: "O" }, status: "active", deletedAt: null } as any]
    );

    expect(options).toEqual([
      { type: "product", id: 1, name: { ar: "أ", en: "A" }, slug: "a" },
      { type: "offer", id: 7, name: { ar: "د", en: "O" }, slug: "o" }
    ]);
  });
});

describe("EditProductPage data plumbing", () => {
  it("fetches existing related links and passes them plus options to the form", async () => {
    capturedProps = null;
    apiGet.mockResolvedValueOnce({ relatedItems: [{ type: "product", id: 2 }] });

    await act(async () => {
      render(
        createElement(
          Suspense,
          { fallback: null },
          createElement(EditProductPage, { params: Promise.resolve({ id: "1" }) })
        )
      );
    });

    await screen.findByTestId("product-form");
    await waitFor(() => {
      expect(capturedProps?.initial?.relatedItems).toEqual([{ type: "product", id: 2 }]);
    });

    expect(apiGet).toHaveBeenCalledWith("/api/erp/products/1");
    expect(capturedProps.mode).toBe("edit");
    expect(capturedProps.initial.id).toBe(1);
    // Options come from the store's active, non-deleted products + offers.
    expect(capturedProps.relatedOptions).toEqual([
      { type: "product", id: 1, name: { ar: "منتج", en: "Product 1" }, slug: "product-1" },
      { type: "product", id: 2, name: { ar: "منتج٢", en: "Product 2" }, slug: "product-2" },
      { type: "offer", id: 9, name: { ar: "عرض", en: "Offer 9" }, slug: "offer-9" }
    ]);
  });

  it("renders the form in safe mode when existing related links fail to load", async () => {
    capturedProps = null;
    apiGet.mockRejectedValueOnce(new Error("boom"));

    await act(async () => {
      render(
        createElement(
          Suspense,
          { fallback: null },
          createElement(EditProductPage, { params: Promise.resolve({ id: "1" }) })
        )
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/تعذر تحميل العناصر المرتبطة/)).toBeInTheDocument();
    });
    expect(screen.getByTestId("product-form")).toBeInTheDocument();
    expect(capturedProps.initial.id).toBe(1);
    expect(capturedProps.initial.relatedItems).toBeUndefined();
    expect(capturedProps.relatedItemsAvailable).toBe(false);
  });
});
