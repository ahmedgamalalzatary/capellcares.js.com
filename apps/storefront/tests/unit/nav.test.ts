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

const storefrontOrderingCategories = [
  { id: 1, parentId: null, slug: "care", name: { ar: "العناية", en: "Care" }, sortOrder: 2, isLeaf: false, createdAt: "2026-06-08T09:00:00.000Z" },
  { id: 6, parentId: null, slug: "bath", name: { ar: "الاستحمام", en: "Bath" }, sortOrder: 1, isLeaf: true, createdAt: "2026-06-07T09:00:00.000Z" },
  { id: 7, parentId: null, slug: "hair", name: { ar: "الشعر", en: "Hair" }, isLeaf: true, createdAt: "2026-06-12T09:00:00.000Z" },
  { id: 8, parentId: null, slug: "fragrance", name: { ar: "العطور", en: "Fragrance" }, isLeaf: true, createdAt: "2026-06-10T09:00:00.000Z" }
] as Category[];

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

  it("keeps ranked roots first and then newer unranked roots first in storefront navigation", () => {
    const nav = buildNav(storefrontOrderingCategories, "en");

    expect(nav.map((group) => group.root.id)).toEqual([6, 1, 7, 8]);
  });
});
