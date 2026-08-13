import { describe, expect, it } from "vitest";
import type { Category, OrderItem } from "@capella/shared";
import { orderItemCategory, type Catalog } from "@/components/orders/order-presentation";

const categories: Category[] = [
  { id: 5, parentId: null, slug: "serums", name: { ar: "سيرومات", en: "Serums" }, isLeaf: true }
];

const catalog: Catalog = {
  products: [{
    id: 1,
    sku: "SKU-1",
    slug: "rose-serum",
    name: { ar: "سيروم الورد", en: "Rose Serum" },
    description: { ar: "", en: "" },
    imagePath: "/rose.png",
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 5,
    variants: [{ id: 11, productId: 1, size: "30ml", price: 200, stock: 4 }],
    createdAt: "",
    updatedAt: ""
  } as any],
  offers: [],
  collections: [],
  categories,
  loaded: true
};

const productLine: OrderItem = {
  id: 20,
  itemType: "product_variant",
  variantId: 11,
  offerId: null,
  collectionId: null,
  qty: 1,
  unitPrice: 200,
  lineTotal: 200,
  snapshotNameAr: "سيروم الورد",
  snapshotNameEn: "Rose Serum",
  snapshotSizeLabel: "30ml"
} as OrderItem;

describe("orderItemCategory", () => {
  it("resolves a product line to its localized category name", () => {
    expect(orderItemCategory(productLine, catalog, "en")).toBe("Serums");
    expect(orderItemCategory(productLine, catalog, "ar")).toBe("سيرومات");
  });

  it("returns null when the product no longer exists in the catalog", () => {
    expect(orderItemCategory({ ...productLine, variantId: 999 }, catalog, "en")).toBeNull();
  });

  it("returns null for non-product lines", () => {
    const offerLine = { ...productLine, itemType: "offer", variantId: null, offerId: 3 } as OrderItem;
    expect(orderItemCategory(offerLine, catalog, "en")).toBeNull();
  });
});
