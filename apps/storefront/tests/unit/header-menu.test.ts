import { describe, expect, it } from "vitest";
import type { Product } from "@capella/shared";

import { buildHeaderMenu } from "@/lib/header-menu";
import type { NavGroup } from "@/lib/nav";

const navGroups: NavGroup[] = [
  {
    root: { id: 10, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false },
    children: []
  },
  {
    root: { id: 11, parentId: null, slug: "body-care", name: { ar: "العناية بالجسم", en: "Body Care" }, isLeaf: false },
    children: []
  }
];

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 1,
    sku: "sku-1",
    slug: "product-1",
    name: { ar: "منتج", en: "Product" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 100,
    imagePath: "/product.jpg",
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 10,
    variants: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("buildHeaderMenu", () => {
  it("places New and Bestsellers entries before category groups", () => {
    const menu = buildHeaderMenu({
      navGroups,
      products: [
        makeProduct({ id: 1, slug: "new-product", isNew: true }),
        makeProduct({ id: 2, slug: "best-product", isBestseller: true }),
        makeProduct({ id: 3, slug: "plain-product" })
      ],
      dict: {
        nav: {
          new: "New",
          bestsellers: "Best Seller"
        }
      },
      lang: "en"
    });

    expect(menu.map((entry) => entry.label)).toEqual([
      "New",
      "Best Seller",
      "Skin Care",
      "Body Care"
    ]);
    expect(menu[0]).toMatchObject({
      type: "products",
      slug: "new",
      products: [{ slug: "new-product" }]
    });
    expect(menu[1]).toMatchObject({
      type: "products",
      slug: "bestsellers",
      products: [{ slug: "best-product" }]
    });
  });
});
