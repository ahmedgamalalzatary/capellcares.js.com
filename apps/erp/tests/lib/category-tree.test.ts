import { describe, expect, it } from "vitest";
import type { Category } from "@capella/shared";
import { isInCategoryTree } from "@/lib/category-tree";

const cat = (id: number, parentId: number | null) => ({ id, parentId } as Category);

describe("isInCategoryTree", () => {
  const tree = [cat(1, null), cat(2, 1), cat(3, 2), cat(9, null)];

  it("returns true when the category is the selected one", () => {
    expect(isInCategoryTree(tree, 2, 2)).toBe(true);
  });

  it("returns true for a deep descendant of the selected category", () => {
    expect(isInCategoryTree(tree, 3, 1)).toBe(true);
  });

  it("returns false for a category outside the selected branch", () => {
    expect(isInCategoryTree(tree, 9, 1)).toBe(false);
  });

  it("returns false when the category id is null", () => {
    expect(isInCategoryTree(tree, null, 1)).toBe(false);
  });

  it("returns false and stops on a parent cycle", () => {
    const cyclic = [cat(1, 2), cat(2, 1)];
    expect(isInCategoryTree(cyclic, 1, 99)).toBe(false);
  });
});
