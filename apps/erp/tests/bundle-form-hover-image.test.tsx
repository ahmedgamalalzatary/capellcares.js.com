import { createElement } from "react";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

const upsertOffer = vi.fn().mockResolvedValue(undefined);
const upsertCollection = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/store", () => ({
  getStore: () => ({ upsertOffer, upsertCollection })
}));

vi.mock("@/components/forms/editor-form-parts", () => ({
  BilingualEditorField: () => createElement("div"),
  BilingualNameFields: () => createElement("div"),
  EditorActions: () => createElement("div"),
  ImageFieldCard: ({ uploadSlot }: any) => createElement("div", null, uploadSlot)
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
    Chevron: () => createElement("span", null, "^"),
    Upload: () => createElement("span", null, "upload")
  }
}));

import { OfferForm } from "@/components/forms/offer-form";
import { CollectionForm } from "@/components/forms/collection-form";
import { useOfferForm } from "@/hooks/forms/use-offer-form";
import { useCollectionForm } from "@/hooks/forms/use-collection-form";

const product = {
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
  variants: [
    { id: 11, productId: 10, size: "100ml", price: 50, stock: 5, sortOrder: 1 },
    { id: 12, productId: 10, size: "200ml", price: 80, stock: 5, sortOrder: 2 }
  ],
  createdAt: "",
  updatedAt: ""
};

const categories = [
  { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, deletedAt: null },
  { id: 2, parentId: 1, slug: "skin-cream", name: { ar: "كريمات", en: "Creams" }, isLeaf: true, deletedAt: null }
];

const media = [{ type: "image" as const, arUrl: null, enUrl: "/uploads/bundle.png" }];

afterEach(() => {
  cleanup();
  upsertOffer.mockClear();
  upsertCollection.mockClear();
});

describe("bundle forms hover image", () => {
  it("renders the hover-image upload section on the offer form", () => {
    render(createElement(OfferForm, { mode: "edit", categories, products: [product] } as any));
    expect(screen.getByTestId("offer-hover-image-ar-input")).toBeInTheDocument();
    expect(screen.getByTestId("offer-hover-image-en-input")).toBeInTheDocument();
  });

  it("renders the hover-image upload section on the collection form", () => {
    render(createElement(CollectionForm, { mode: "edit", categories, products: [product] } as any));
    expect(screen.getByTestId("collection-hover-image-ar-input")).toBeInTheDocument();
    expect(screen.getByTestId("collection-hover-image-en-input")).toBeInTheDocument();
  });

  it("hydrates and persists hover images through the offer save payload", async () => {
    const { result } = renderHook(() => useOfferForm({
      mode: "edit",
      initial: {
        id: 1,
        slug: "hover-offer",
        name: { ar: "عرض", en: "Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/bundle.png",
        media,
        arHoverImagePath: "/uploads/offer-hover-ar.jpg",
        enHoverImagePath: "/uploads/offer-hover-en.jpg",
        price: 100,
        originalTotal: 130,
        categoryId: 2,
        items: [
          { id: 1, variantId: 11, qty: 1 },
          { id: 2, variantId: 12, qty: 1 }
        ],
        stock: 0,
        status: "active",
        visibility: "visible",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      },
      categories,
      products: [product]
    } as any));

    expect(result.current.arHoverImagePath).toBe("/uploads/offer-hover-ar.jpg");
    expect(result.current.enHoverImagePath).toBe("/uploads/offer-hover-en.jpg");

    await act(async () => {
      await result.current.save();
    });

    const payload = upsertOffer.mock.calls[0]?.[0];
    expect(payload.hoverImagePath).toBe("/uploads/offer-hover-en.jpg");
    expect(payload.arHoverImagePath).toBe("/uploads/offer-hover-ar.jpg");
    expect(payload.enHoverImagePath).toBe("/uploads/offer-hover-en.jpg");
  });

  it("does not seed English from the Arabic fallback when the API cleared the English hover image", async () => {
    const { result } = renderHook(() => useOfferForm({
      mode: "edit",
      initial: {
        id: 1,
        slug: "arabic-only-offer",
        name: { ar: "عرض", en: "Offer" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/bundle.png",
        media,
        // The admin API's localized read: hoverImagePath falls back to Arabic, enHoverImagePath is explicitly null.
        hoverImagePath: "/uploads/offer-hover-ar.jpg",
        arHoverImagePath: "/uploads/offer-hover-ar.jpg",
        enHoverImagePath: null,
        price: 100,
        originalTotal: 130,
        categoryId: 2,
        items: [
          { id: 1, variantId: 11, qty: 1 },
          { id: 2, variantId: 12, qty: 1 }
        ],
        stock: 0,
        status: "active",
        visibility: "visible",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      },
      categories,
      products: [product]
    } as any));

    expect(result.current.arHoverImagePath).toBe("/uploads/offer-hover-ar.jpg");
    expect(result.current.enHoverImagePath).toBe("");

    await act(async () => {
      await result.current.save();
    });

    const payload = upsertOffer.mock.calls[0]?.[0];
    expect(payload.hoverImagePath).toBe("");
    expect(payload.arHoverImagePath).toBe("/uploads/offer-hover-ar.jpg");
    expect(payload.enHoverImagePath).toBe(null);
  });

  it("hydrates and persists hover images through the collection save payload", async () => {
    const { result } = renderHook(() => useCollectionForm({
      mode: "edit",
      initial: {
        id: 1,
        slug: "hover-collection",
        name: { ar: "مجموعة", en: "Collection" },
        description: { ar: "", en: "" },
        imagePath: "/uploads/bundle.png",
        media,
        arHoverImagePath: "/uploads/collection-hover-ar.jpg",
        enHoverImagePath: "/uploads/collection-hover-en.jpg",
        price: 100,
        originalTotal: 130,
        categoryId: 2,
        items: [
          { id: 1, variantId: 11, qty: 1 },
          { id: 2, variantId: 12, qty: 1 }
        ],
        stock: 0,
        status: "active",
        visibility: "visible",
        createdAt: "",
        updatedAt: "",
        deletedAt: null
      },
      categories,
      products: [product]
    } as any));

    expect(result.current.arHoverImagePath).toBe("/uploads/collection-hover-ar.jpg");
    expect(result.current.enHoverImagePath).toBe("/uploads/collection-hover-en.jpg");

    await act(async () => {
      await result.current.save();
    });

    const payload = upsertCollection.mock.calls[0]?.[0];
    expect(payload.hoverImagePath).toBe("/uploads/collection-hover-en.jpg");
    expect(payload.arHoverImagePath).toBe("/uploads/collection-hover-ar.jpg");
    expect(payload.enHoverImagePath).toBe("/uploads/collection-hover-en.jpg");
  });
});
