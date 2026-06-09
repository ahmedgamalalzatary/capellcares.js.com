import { describe, expect, it } from "vitest";

import type { Category } from "@capella/shared";
import { buildNav } from "@/lib/nav";

const categories: Category[] = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, sortOrder: 2, isLeaf: false },
  { id: 2, parentId: 1, slug: "skin", name: { ar: "البشرة", en: "Skin" }, isLeaf: false },
  { id: 3, parentId: 2, slug: "serums", name: { ar: "سيروم", en: "Serums" }, isLeaf: false },
  { id: 4, parentId: 3, slug: "vitamin-c", name: { ar: "فيتامين سي", en: "Vitamin C" }, isLeaf: true },
  { id: 5, parentId: 1, slug: "body", name: { ar: "الجسم", en: "Body" }, isLeaf: true },
  { id: 6, parentId: null, slug: "bath", name: { ar: "الاستحمام", en: "Bath" }, sortOrder: 1, isLeaf: true }
];

describe("buildNav", () => {
  it("builds recursive nav nodes for arbitrarily deep category trees", () => {
    const nav = buildNav(categories, "en");

    expect(nav).toHaveLength(2);
    expect(nav[0].root.id).toBe(6);
    expect(nav[1].root.id).toBe(1);
    expect(nav[1].children.map((child) => child.id)).toEqual([2, 5]);
    expect(nav[1].children[0].children[0].id).toBe(3);
    expect(nav[1].children[0].children[0].children[0].id).toBe(4);
  });

  it("orders root categories by sortOrder ascending", () => {
    const nav = buildNav(categories, "en");

    expect(nav.map((group) => group.root.id)).toEqual([6, 1]);
    expect(nav[1].children.map((child) => child.id)).toEqual([2, 5]);
  });
});
