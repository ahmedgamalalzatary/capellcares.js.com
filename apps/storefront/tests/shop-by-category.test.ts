import { describe, expect, it } from "vitest";
import { selectShopByCategories, type StorefrontCategory } from "@/lib/categories";

function makeCategory(overrides: Partial<StorefrontCategory> & { id: number }): StorefrontCategory {
  return {
    parentId: null,
    slug: `cat-${overrides.id}`,
    sortOrder: overrides.id,
    name: { ar: `قسم ${overrides.id}`, en: `Category ${overrides.id}` },
    imagePath: null,
    isLeaf: true,
    deletedAt: null,
    ...overrides
  };
}

describe("selectShopByCategories", () => {
  it("returns image-bearing root and depth-1 categories but excludes deeper categories", () => {
    const root = makeCategory({ id: 1, parentId: null, imagePath: "/uploads/root.png" });
    const depthOneWithImage = makeCategory({ id: 2, parentId: 1, imagePath: "/uploads/slides.png" });
    const depthOneNoImage = makeCategory({ id: 3, parentId: 1, imagePath: null });
    const depthTwoWithImage = makeCategory({ id: 4, parentId: 2, imagePath: "/uploads/deep.png" });

    const result = selectShopByCategories([root, depthOneWithImage, depthOneNoImage, depthTwoWithImage]);

    expect(result.map((c) => c.id)).toEqual([1, 2]);
  });

  it("places roots first and sorts each depth by sortOrder", () => {
    const root = makeCategory({ id: 1, parentId: null, imagePath: "/root.png", sortOrder: 30 });
    const second = makeCategory({ id: 2, parentId: 1, imagePath: "/a.png", sortOrder: 20 });
    const first = makeCategory({ id: 3, parentId: 1, imagePath: "/b.png", sortOrder: 10 });

    const result = selectShopByCategories([root, second, first]);

    expect(result.map((c) => c.id)).toEqual([1, 3, 2]);
  });

  it("excludes soft-deleted categories and children of deleted parents", () => {
    const liveRoot = makeCategory({ id: 1, parentId: null });
    const deletedRoot = makeCategory({ id: 2, parentId: null, deletedAt: "2026-01-01T00:00:00Z" });
    const deletedChild = makeCategory({ id: 3, parentId: 1, imagePath: "/x.png", deletedAt: "2026-01-01T00:00:00Z" });
    const orphanOfDeletedRoot = makeCategory({ id: 4, parentId: 2, imagePath: "/y.png" });
    const valid = makeCategory({ id: 5, parentId: 1, imagePath: "/z.png" });

    const result = selectShopByCategories([liveRoot, deletedRoot, deletedChild, orphanOfDeletedRoot, valid]);

    expect(result.map((c) => c.id)).toEqual([5]);
  });
});
