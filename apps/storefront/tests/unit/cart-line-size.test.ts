import { describe, expect, it } from "vitest";
import { cartLineSizeLabel } from "@/lib/cart-line-size";
import type { Collection, Offer, Product } from "@capella/shared";

const products: Product[] = [
  {
    id: 1,
    sku: "SKU-1",
    slug: "serum",
    name: { ar: "سيروم", en: "Serum" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 10,
    imagePath: "/a.png",
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 1,
    variants: [
      { id: 11, productId: 1, size: "30ml", price: 100, stock: 4 },
      { id: 12, productId: 1, size: "50ml", price: 150, stock: 4 }
    ],
    createdAt: "",
    updatedAt: ""
  }
];

const offers: Offer[] = [
  {
    id: 2,
    slug: "duo",
    name: { ar: "عرض", en: "Duo" },
    description: { ar: "", en: "" },
    imagePath: "/o.png",
    price: 200,
    originalTotal: 250,
    categoryId: 1,
    items: [
      { variantId: 11, qty: 1 },
      { variantId: 12, qty: 1 }
    ],
    stock: 4,
    status: "active",
    visibility: "visible",
    createdAt: "",
    updatedAt: ""
  }
];

const collections: Collection[] = [
  {
    id: 3,
    slug: "set",
    name: { ar: "مجموعة", en: "Set" },
    description: { ar: "", en: "" },
    imagePath: "/c.png",
    price: 300,
    originalTotal: 350,
    categoryId: 1,
    items: [{ variantId: 11, qty: 2 }],
    stock: 4,
    status: "active",
    visibility: "visible",
    createdAt: "",
    updatedAt: ""
  }
];

const catalog = { products, offers, collections };

describe("cartLineSizeLabel", () => {
  it("returns the chosen product variant size", () => {
    expect(cartLineSizeLabel({ type: "product", productId: 1, variantId: 12, qty: 1 }, catalog)).toBe("50ml");
  });

  it("joins the included offer variant sizes", () => {
    expect(cartLineSizeLabel({ type: "offer", offerId: 2, qty: 1 }, catalog)).toBe("30ml, 50ml");
  });

  it("returns the included collection variant sizes", () => {
    expect(cartLineSizeLabel({ type: "collection", collectionId: 3, qty: 1 }, catalog)).toBe("30ml");
  });
});
