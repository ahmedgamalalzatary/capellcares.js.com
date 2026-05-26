"use client";

import { useMemo, useState } from "react";
import type { Category, Language, Product } from "@capella/shared";

import type { CategoryTreeItem, PriceRange, Sort } from "./product-grid.types";
import { isDescendantOf, minVariantPrice, safeName } from "./product-grid.utils";

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

  const categoryById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories]
  );

  const categoryTree = useMemo<CategoryTreeItem[]>(() => {
    const parents = categories.filter((item) => item.parentId === null);
    if (parents.length === 0) return [];
    return parents.map((parent) => ({
      parent,
      children: categories.filter((item) => item.parentId === parent.id)
    }));
  }, [categories]);

  const [openParents, setOpenParents] = useState<Record<number, boolean>>(() => {
    const selectedId = initialCategory;
    if (!selectedId) return {};
    const directParent = categories.find((item) => item.id === selectedId)?.parentId;
    return directParent ? { [directParent]: true } : { [selectedId]: true };
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
