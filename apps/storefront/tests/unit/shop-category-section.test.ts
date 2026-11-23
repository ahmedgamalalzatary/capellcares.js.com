import { describe, expect, it } from "vitest";
import type { Category, Product } from "@capella/shared";
import { CATEGORY_SECTION_PRODUCT_LIMIT, pickCategoryRowProducts } from "@/lib/shop-category-section";

function category(id: number, parentId: number | null): Category {
  return { id, parentId, slug: `c${id}`, name: { ar: `ق${id}`, en: `C${id}` }, isLeaf: false };
}

function product(id: number, categoryId: number, createdAt: string, extra: Partial<Product> = {}): Product {
  return { id, categoryId, createdAt, status: "active", deletedAt: null, ...extra } as Product;
}

// 1 ─┬─ 2 ── 4
//    └─ 3
// 5 (another main category)
const categories = [category(1, null), category(2, 1), category(3, 1), category(4, 2), category(5, null)];

describe("pickCategoryRowProducts", () => {
  it("takes a main category's products from every level beneath it, in the shop's product order", () => {
    const products = [
      product(10, 1, "2026-01-01T00:00:00Z"),
      product(11, 4, "2026-03-01T00:00:00Z"),
      product(12, 3, "2026-02-01T00:00:00Z"),
      product(13, 5, "2026-04-01T00:00:00Z")
    ];
    expect(pickCategoryRowProducts(1, categories, products).map((p) => p.id)).toEqual([10, 11, 12]);
  });

  it("takes only a sub category's own branch", () => {
    const products = [product(10, 1, "2026-01-01T00:00:00Z"), product(11, 4, "2026-03-01T00:00:00Z"), product(12, 2, "2026-02-01T00:00:00Z")];
    expect(pickCategoryRowProducts(2, categories, products).map((p) => p.id)).toEqual([11, 12]);
  });

  it("leaves out hidden and deleted products", () => {
    const products = [
      product(10, 1, "2026-01-01T00:00:00Z", { status: "inactive" as Product["status"] }),
      product(11, 1, "2026-01-02T00:00:00Z", { deletedAt: "2026-05-01T00:00:00Z" }),
      product(12, 1, "2026-01-03T00:00:00Z")
    ];
    expect(pickCategoryRowProducts(1, categories, products).map((p) => p.id)).toEqual([12]);
  });

  it("shows at most 12 products", () => {
    const products = Array.from({ length: 20 }, (_, index) => product(index + 1, 1, `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`));
    const picked = pickCategoryRowProducts(1, categories, products);
    expect(CATEGORY_SECTION_PRODUCT_LIMIT).toBe(12);
    expect(picked).toHaveLength(12);
    expect(picked.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("returns nothing for a category that no longer exists", () => {
    expect(pickCategoryRowProducts(99, categories, [product(10, 1, "2026-01-01T00:00:00Z")])).toEqual([]);
  });
});
