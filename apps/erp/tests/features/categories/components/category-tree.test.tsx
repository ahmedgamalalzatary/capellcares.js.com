import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Category } from "@capella/shared";
import { Tree } from "@/features/categories/components/category-tree";

describe("category tree pictures", () => {
  it.each([
    {
      name: "uses the Arabic shop picture for a main category",
      parentId: null,
      imagePath: "/uploads/stale-child.webp",
      arShopImagePath: "https://media.example.com/body-ar.webp",
      enShopImagePath: "https://media.example.com/body-en.webp",
      expected: "https://media.example.com/body-ar.webp"
    },
    {
      name: "falls back to the English shop picture for a main category",
      parentId: null,
      arShopImagePath: null,
      enShopImagePath: "https://media.example.com/body-en.webp",
      expected: "https://media.example.com/body-en.webp"
    },
    {
      name: "keeps the subcategory picture for a child category",
      parentId: 1,
      imagePath: "https://media.example.com/serums.webp",
      expected: "https://media.example.com/serums.webp"
    },
    {
      name: "shows the initial when a main category has no shop picture",
      parentId: null,
      expected: null
    }
  ])("$name", ({ expected, name: _name, ...pictures }) => {
    const category: Category = {
      id: 2,
      slug: "body-care",
      name: { ar: "Body AR", en: "Body Care" },
      isLeaf: true,
      deletedAt: null,
      ...pictures
    };
    render(createElement(Tree, {
      children: [category],
      depth: category.parentId === null ? 0 : 1,
      tree: new Map(),
      productCount: new Map(),
      canEdit: false,
      canDelete: false,
      reorderEnabled: false,
      filtering: false,
      onDelete: vi.fn(),
      onMoveCategory: vi.fn(),
      collapsed: new Set<number>(),
      onToggleCollapsed: vi.fn()
    }));

    const row = screen.getByTestId("category-row-2");
    const image = row.querySelector("img");
    if (expected) {
      expect(image).toHaveAttribute("src", expected);
    } else {
      expect(image).toBeNull();
      expect(within(row).getByText("B")).toBeInTheDocument();
    }
  });
});
