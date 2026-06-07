"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category, Language, Product } from "@capella/shared";

import type { CategoryTreeNode, PriceRange, Sort } from "../types/product-grid.types";
import { isDescendantOf, minVariantPrice, safeName } from "../utils/product-grid.utils";

interface UseProductGridFiltersOptions {
  products: Product[];
  categories: Category[];
  lang: Language;
  initialSearch?: string;
  initialCategory?: number;
}

export function useProductGridFilters({
  products,
  categories,
  lang,
  initialSearch = "",
  initialCategory
}: UseProductGridFiltersOptions) {
  const [q, setQ] = useState(initialSearch);
  const [category, setCategory] = useState<number | undefined>(initialCategory);
  const [sort, setSort] = useState<Sort>("newest");
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: "", max: "" });

  useEffect(() => { setQ(initialSearch); }, [initialSearch]);
  useEffect(() => { setCategory(initialCategory); }, [initialCategory]);

  const categoryById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories]
  );

  const categoryTree = useMemo<CategoryTreeNode[]>(() => {
    const active = categories.filter((item) => !item.deletedAt);
    const byParent = new Map<number | null, Category[]>();

    for (const category of active) {
      const children = byParent.get(category.parentId) ?? [];
      children.push(category);
      byParent.set(category.parentId, children);
    }

    const buildNodes = (parentId: number | null): CategoryTreeNode[] =>
      (byParent.get(parentId) ?? []).map((category) => ({
        category,
        children: buildNodes(category.id)
      }));

    return buildNodes(null);
  }, [categories]);

  const [openParents, setOpenParents] = useState<Record<number, boolean>>(() => {
    const selectedId = initialCategory;
    if (!selectedId) return {};

    const openState: Record<number, boolean> = {};
    let current = categories.find((item) => item.id === selectedId);
    while (current) {
      openState[current.id] = true;
      current = current.parentId != null ? categories.find((item) => item.id === current?.parentId) : undefined;
    }

    return openState;
  });

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const min = Number(priceRange.min) || 0;
    const max = Number(priceRange.max) || Infinity;

    return products
      .filter((product) => {
        if (ql) {
          const name = safeName(product, lang).toLowerCase();
          if (!name.includes(ql)) return false;
        }
        if (category) {
          const sameCategory = product.categoryId === category;
          const descendantMatch = isDescendantOf(product.categoryId, category, categoryById);
          if (!sameCategory && !descendantMatch) return false;
        }
        const minVariant = minVariantPrice(product);
        if (!Number.isFinite(minVariant)) return false;
        if (minVariant < min || minVariant > max) return false;
        return true;
      })
      .sort((a, b) => {
        const ap = minVariantPrice(a);
        const bp = minVariantPrice(b);
        if (sort === "price-asc") return ap - bp;
        if (sort === "price-desc") return bp - ap;
        if (sort === "name") return safeName(a, lang).localeCompare(safeName(b, lang));
        return b.id - a.id;
      });
  }, [products, q, category, sort, priceRange, lang, categoryById]);

  const toggleParent = (parentId: number) => {
    setOpenParents((current) => ({ ...current, [parentId]: !current[parentId] }));
  };

  const handleClear = () => {
    setQ("");
    setCategory(initialCategory);
    setSort("newest");
    setPriceRange({ min: "", max: "" });
  };

  const hasActiveFilters = Boolean(
    q || category !== initialCategory || priceRange.min || priceRange.max
  );

  return {
    q,
    setQ,
    category,
    setCategory,
    sort,
    setSort,
    priceRange,
    setPriceRange,
    categoryTree,
    openParents,
    toggleParent,
    filtered,
    handleClear,
    hasActiveFilters
  };
}
