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

const mockedUseAdminAuth = vi.fn(() => ({
  user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["offers.read", "offers.update"] },
  hydrated: true,
  logout: vi.fn()
}));

vi.mock("@/components/providers/admin-auth", () => ({
  useAdminAuth: () => mockedUseAdminAuth()
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  }
}));

let capturedProps: any = null;
vi.mock("@/components/forms/offer-form", () => ({
  OfferForm: (props: any) => {
    capturedProps = props;
    return createElement("div", { "data-testid": "offer-form" });
  }
}));

const storeState = {
  offers: [
    {
      id: 7,
      slug: "offer-7",
      name: { ar: "عرض", en: "Offer 7" },
      description: { ar: "وصف", en: "Description" },
      imagePath: "/uploads/offer.jpg",
      price: 100,
      originalTotal: 140,
      items: [{ variantId: 1, qty: 1 }],
      stock: 4,
      status: "active" as const,
      createdAt: "",
      updatedAt: ""
    }
  ],
  products: [
    {
      id: 10,
      sku: "P10",
      slug: "product-10",
      name: { ar: "منتج", en: "Product 10" },
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
      variants: [{ id: 1, productId: 10, size: "100ml", price: 50, stock: 5, sortOrder: 1 }],
      createdAt: "",
      updatedAt: ""
    }
  ],
  collections: [
    { id: 12, slug: "collection-12", name: { ar: "مجموعة", en: "Collection 12" }, status: "active", deletedAt: null }
  ],
  loaded: true,
  error: null
};

vi.mock("@/lib/store", () => ({
  useStore: (selector: any) => selector(storeState)
}));

import EditOfferPage from "@/app/offers/[id]/edit/page";

describe("EditOfferPage data plumbing", () => {
  it("fetches existing related links and passes collection options to the form", async () => {
    capturedProps = null;
    mockedUseAdminAuth.mockReturnValue({
      user: { name: "Admin User", email: "admin@capella.test", role: "admin", permissionKeys: ["offers.read", "offers.update"] },
      hydrated: true,
      logout: vi.fn()
    });
    apiGet.mockResolvedValueOnce({ relatedItems: [{ type: "collection", id: 12 }] });

    await act(async () => {
      render(
        createElement(
          Suspense,
          { fallback: null },
          createElement(EditOfferPage, { params: Promise.resolve({ id: "7" }) })
        )
      );
    });

    await screen.findByTestId("offer-form");
    await waitFor(() => {
      expect(capturedProps?.initial?.relatedItems).toEqual([{ type: "collection", id: 12 }]);
    });

    expect(apiGet).toHaveBeenCalledWith("/api/erp/offers/7");
    expect(capturedProps.relatedOptions).toEqual([
      { type: "product", id: 10, name: { ar: "منتج", en: "Product 10" }, slug: "product-10" },
      { type: "offer", id: 7, name: { ar: "عرض", en: "Offer 7" }, slug: "offer-7" },
      { type: "collection", id: 12, name: { ar: "مجموعة", en: "Collection 12" }, slug: "collection-12" }
    ]);
  });
});
