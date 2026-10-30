"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Category, Language, Product } from "@capella/shared";

import type { AttributeFilterKey, CategoryTreeNode, PriceRange, Sort } from "../types/product-grid.types";
import { isInCategoryBranch, minVariantPrice, safeName } from "../utils/product-grid.utils";
import { matchesProductQuery } from "../lib/product-search";
import { isListedCategory } from "../lib/category-links";

interface UseProductGridFiltersOptions {
  products: Product[];
  categories: Category[];
  categoryLookupCategories?: Category[];
  lang: Language;
  initialSearch?: string;
  initialCategory?: number;
  headerCategoryIds?: number[];
  onHeaderCategoryIdsChange?: (value: number[]) => void;
}

const NO_ATTRIBUTE_FILTERS: Record<AttributeFilterKey, number[]> = { brand: [], age: [], character: [] };

export function useProductGridFilters({
  products,
  categories,
  categoryLookupCategories,
  lang,
  initialSearch = "",
  initialCategory,
  headerCategoryIds = [],
  onHeaderCategoryIdsChange
}: UseProductGridFiltersOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialSearch);
  const [category, setCategory] = useState<number | undefined>(initialCategory);
  // Preserve API ordering by default; merchandising/search rules may change this later.
  const [sort, setSort] = useState<Sort>("default");
  const [priceRange, setPriceRange] = useState<PriceRange>({ min: "", max: "" });
  const [attributeFilters, setAttributeFilters] = useState<Record<AttributeFilterKey, number[]>>(NO_ATTRIBUTE_FILTERS);

  useEffect(() => { setQ(initialSearch); }, [initialSearch]);
  useEffect(() => { setCategory(initialCategory); }, [initialCategory]);
  useEffect(() => {
    if (headerCategoryIds.length === 0) {
      return;
    }

    setQ("");
    setCategory(initialCategory);
    setSort("default");
    setPriceRange({ min: "", max: "" });
    setAttributeFilters(NO_ATTRIBUTE_FILTERS);
  }, [headerCategoryIds, initialCategory]);

  const categoryById = useMemo(
    () => new Map((categoryLookupCategories ?? categories).map((item) => [item.id, item])),
    [categories, categoryLookupCategories]
  );
  useEffect(() => {
    if (!/^\/(ar|en)\/products$/.test(pathname)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const nextCategoryId = category != null ? String(category) : undefined;
    const currentCategoryId = searchParams.get("categoryId") ?? undefined;

    if (nextCategoryId === currentCategoryId || (!nextCategoryId && !currentCategoryId)) {
      return;
    }

    params.delete("category");

    if (nextCategoryId) {
      params.set("categoryId", nextCategoryId);
    } else {
      params.delete("categoryId");
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [category, pathname, router, searchParams]);

  const categoryTree = useMemo<CategoryTreeNode[]>(() => {
    const active = categories.filter(isListedCategory);
    const activeIds = new Set(active.map((item) => item.id));
    const byParent = new Map<number | null, Category[]>();
    const compareCategories = (a: Category, b: Category) =>
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;

    for (const category of active) {
      const children = byParent.get(category.parentId) ?? [];
      children.push(category);
      byParent.set(category.parentId, children);
    }

    const buildNodes = (parentId: number | null): CategoryTreeNode[] =>
      (byParent.get(parentId) ?? []).sort(compareCategories).map((category) => ({
        category,
        children: buildNodes(category.id)
      }));

    return active
      .filter((category) => category.parentId == null || !activeIds.has(category.parentId))
      .sort(compareCategories)
      .map((category) => ({
        category,
        children: buildNodes(category.id)
      }));
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

  const clearHeaderCategories = () => {
    if (headerCategoryIds.length > 0) {
      onHeaderCategoryIdsChange?.([]);
    }
  };

  const updateSearch = (value: string) => {
    clearHeaderCategories();
    setQ(value);
  };

  const updateCategory = (value: number | undefined) => {
    clearHeaderCategories();
    setCategory(value);
  };

  const updateSort = (value: Sort) => {
    clearHeaderCategories();
    setSort(value);
  };

  const updatePriceRange: React.Dispatch<React.SetStateAction<PriceRange>> = (value) => {
    clearHeaderCategories();
    setPriceRange(value);
  };

  const toggleAttributeFilter = (key: AttributeFilterKey, id: number) => {
    clearHeaderCategories();
    setAttributeFilters((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id]
    }));
  };

  const updateHeaderCategoryIds = (value: number[]) => {
    onHeaderCategoryIdsChange?.(value);
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const min = Number(priceRange.min) || 0;
    const max = Number(priceRange.max) || Infinity;

    return products
      .filter((product) => {
        if (headerCategoryIds.length > 0) {
          const matchesHeaderCategory = headerCategoryIds.some((selectedCategoryId) =>
            isInCategoryBranch(product.categoryId, selectedCategoryId, categoryById)
          );
          if (!matchesHeaderCategory) return false;
        }
        // Same matcher the header overlay previews with, so "view all" always lands on at least the results the dropdown showed.
        if (!matchesProductQuery(product, ql)) return false;
        if (category) {
          if (!isInCategoryBranch(product.categoryId, category, categoryById)) return false;
        }
        const minVariant = minVariantPrice(product);
        if (!Number.isFinite(minVariant)) return false;
        if (minVariant < min || minVariant > max) return false;
        if (attributeFilters.brand.length > 0 && !attributeFilters.brand.includes(product.brandId ?? -1)) return false;
        if (attributeFilters.age.length > 0 && !product.ageGroupIds?.some((id) => attributeFilters.age.includes(id))) return false;
        if (attributeFilters.character.length > 0 && !product.characterIds?.some((id) => attributeFilters.character.includes(id))) return false;
        return true;
      })
      .sort((a, b) => {
        const ap = minVariantPrice(a);
        const bp = minVariantPrice(b);
        if (sort === "price-asc") return ap - bp;
        if (sort === "price-desc") return bp - ap;
        if (sort === "name") return safeName(a, lang).localeCompare(safeName(b, lang));
        if (sort === "newest") return b.id - a.id;
        return 0;
      });
  }, [products, q, category, sort, priceRange, attributeFilters, lang, categoryById, headerCategoryIds]);

  const toggleParent = (parentId: number) => {
    setOpenParents((current) => ({ ...current, [parentId]: !current[parentId] }));
  };

  const handleClear = () => {
    setQ("");
    setCategory(initialCategory);
    setSort("default");
    setPriceRange({ min: "", max: "" });
    setAttributeFilters(NO_ATTRIBUTE_FILTERS);
    onHeaderCategoryIdsChange?.([]);
  };

  const hasActiveFilters = Boolean(
    q || category !== initialCategory || priceRange.min || priceRange.max
      || attributeFilters.brand.length || attributeFilters.age.length || attributeFilters.character.length
  );

  return {
    q,
    setQ: updateSearch,
    category,
    setCategory: updateCategory,
    sort,
    setSort: updateSort,
    priceRange,
    setPriceRange: updatePriceRange,
    attributeFilters,
    toggleAttributeFilter,
    categoryTree,
    openParents,
    toggleParent,
    filtered,
    handleClear,
    hasActiveFilters,
    headerCategoryIds,
    setHeaderCategoryIds: updateHeaderCategoryIds
  };
}
