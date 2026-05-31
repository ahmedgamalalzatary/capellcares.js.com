import { createElement, Suspense } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

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
vi.mock("@/components/forms/collection-form", () => ({
  CollectionForm: (props: any) => {
    capturedProps = props;
    return createElement("div", { "data-testid": "collection-form" });
  }
}));

const storeState = {
  collections: [
    {
      id: 4,
      slug: "skin-care-set",
      name: { ar: "مجموعة عناية", en: "Skin Care Set" },
      description: { ar: "وصف", en: "Description" },
      imagePath: "/uploads/collection.jpg",
      price: 250,
      originalTotal: 320,
      categoryId: 11,
      items: [{ id: 41, variantId: 101, qty: 1 }],
      stock: 3,
      status: "active" as const,
      visibility: "visible" as const,
      createdAt: "",
      updatedAt: ""
    }
  ],
  products: [
    {
      id: 10,
      sku: "P10",
      slug: "cleanser",
      name: { ar: "غسول", en: "Cleanser" },
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
      categoryId: 11,
      variants: [{ id: 101, productId: 10, size: "100ml", price: 120, stock: 5, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    }
  ],
  offers: [
    { id: 8, slug: "offer-8", name: { ar: "عرض", en: "Offer" }, status: "active", deletedAt: null }
  ],
  categories: [
    { id: 11, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: true }
  ],
  loaded: true,
  error: null
};

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(storeState)
}));

import EditCollectionPage from "@/app/collections/[id]/edit/page";

describe("EditCollectionPage data plumbing", () => {
  it("fetches existing related links and passes them plus options to the form", async () => {
    capturedProps = null;
    apiGet.mockResolvedValueOnce({ relatedItems: [{ type: "offer", id: 8 }] });

    await act(async () => {
      render(
        createElement(
          Suspense,
          { fallback: null },
          createElement(EditCollectionPage, { params: Promise.resolve({ id: "4" }) })
        )
      );
    });

    await screen.findByTestId("collection-form");
    await waitFor(() => {
      expect(capturedProps?.initial?.relatedItems).toEqual([{ type: "offer", id: 8 }]);
    });

    expect(apiGet).toHaveBeenCalledWith("/api/erp/collections/4");
    expect(capturedProps.mode).toBe("edit");
    expect(capturedProps.initial.id).toBe(4);
    expect(capturedProps.relatedOptions).toEqual([
      { type: "product", id: 10, name: { ar: "غسول", en: "Cleanser" }, slug: "cleanser" },
      { type: "offer", id: 8, name: { ar: "عرض", en: "Offer" }, slug: "offer-8" },
      { type: "collection", id: 4, name: { ar: "مجموعة عناية", en: "Skin Care Set" }, slug: "skin-care-set" }
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
          createElement(EditCollectionPage, { params: Promise.resolve({ id: "4" }) })
        )
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/تعذر تحميل العناصر المرتبطة/)).toBeInTheDocument();
    });
    expect(screen.getByTestId("collection-form")).toBeInTheDocument();
    expect(capturedProps.initial.id).toBe(4);
    expect(capturedProps.initial.relatedItems).toBeUndefined();
    expect(capturedProps.relatedItemsAvailable).toBe(false);
  });
});
