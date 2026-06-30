"use client";

import { useMemo, useState } from "react";
import { pickLang, type Category, type Collection, type Language } from "@capella/shared";
import { SectionCard } from "@/components/shop/section-card";
import { MobileFilterDrawer } from "@/components/products/filters/mobile-filter-drawer";
import { ColumnsToggle, type Cols } from "@/components/ui/columns-toggle";
import type { CategoryTreeNode, Sort } from "@/types/product-grid.types";

/** Walk up to the top-level ("big") ancestor of a category. */
function findRootCategory(categories: Category[], categoryId: number): Category | undefined {
  let current = categories.find((category) => category.id === categoryId);
  const visited = new Set<number>();
  while (current && current.parentId != null) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    current = categories.find((category) => category.id === current?.parentId);
  }
  return current;
}

function isInCategoryTree(categories: Category[], categoryId: number, selectedCategoryId: number) {
  let current = categories.find((category) => category.id === categoryId);
  const visited = new Set<number>();
  while (current) {
    if (visited.has(current.id)) return false;
    if (current.id === selectedCategoryId) return true;
    visited.add(current.id);
    current = current.parentId != null
      ? categories.find((category) => category.id === current?.parentId)
      : undefined;
  }
  return false;
}

function dateValue(value: string | Date | undefined) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CollectionGrid({
  collections,
  categories,
  lang,
  dict
}: {
  collections: Collection[];
  categories: Category[];
  lang: Language;
  dict: any;
}) {
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [pillCategoryIds, setPillCategoryIds] = useState<number[]>([]);
  const [sort, setSort] = useState<Sort>("default");
  const [showFilters, setShowFilters] = useState(false);
  const [cols, setCols] = useState<Cols>(1);

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.deletedAt),
    [categories]
  );

  // Only the big (top-level) categories that actually own at least one collection
  // — leaf subcategories and empty big categories are never offered as filters.
  const bigCategories = useMemo<Category[]>(() => {
    const rootsWithCollections = new Map<number, Category>();
    for (const collection of collections) {
      const root = findRootCategory(activeCategories, collection.categoryId);
      if (root) {
        rootsWithCollections.set(root.id, root);
      }
    }
    return [...rootsWithCollections.values()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [activeCategories, collections]);

  const categoryTree = useMemo<CategoryTreeNode[]>(
    () => bigCategories.map((category) => ({ category, children: [] })),
    [bigCategories]
  );

  const togglePillCategory = (id: number) => {
    setPillCategoryIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const filtered = useMemo(() => {
    const selectedIds = [...pillCategoryIds, ...(categoryId != null ? [categoryId] : [])];
    const next = selectedIds.length === 0
      ? [...collections]
      : collections.filter((collection) =>
        selectedIds.some((selectedId) => isInCategoryTree(activeCategories, collection.categoryId, selectedId))
      );

    switch (sort) {
      case "newest":
        return next.sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
      case "price-asc":
        return next.sort((a, b) => a.price - b.price);
      case "price-desc":
        return next.sort((a, b) => b.price - a.price);
      case "name":
        return next.sort((a, b) => pickLang(a.name, lang).localeCompare(pickLang(b.name, lang), lang));
      default:
        return next;
    }
  }, [activeCategories, categoryId, pillCategoryIds, collections, lang, sort]);

  const hasActiveFilters = categoryId != null || pillCategoryIds.length > 0;

  if (collections.length === 0) {
    return <p className="py-12 text-center text-(--ink-3)">{dict.collections.listEmpty}</p>;
  }

  return (
    <div className="grid gap-6 pb-16 sm:pb-24">
      {bigCategories.length > 0 && (
        <div className="pill-group">
          {bigCategories.map((item) => {
            const active = pillCategoryIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "filter-pill filter-pill--active" : "filter-pill"}
                aria-pressed={active}
                onClick={() => togglePillCategory(item.id)}
              >
                {pickLang(item.name, lang)}
                {active && (
                  <span className="filter-pill__x" aria-hidden="true">
                    X
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-3 border-b border-(--hairline) pb-3.5">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-3">
          <button
            onClick={() => setShowFilters(true)}
            className={`inline-flex h-9.5 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors ${
              hasActiveFilters
                ? "border-ink bg-ink text-canvas"
                : "border-(--hairline-strong) bg-surface text-ink hover:border-ink"
            }`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {dict.common.filters}
            {hasActiveFilters && <span className="inline-block size-1.5 rounded-full bg-canvas/80" />}
          </button>

          <div className="relative inline-flex items-center rounded-md border border-(--hairline-strong) px-1 py-1 text-sm text-ink">
            <span className="pointer-events-none text-(--ink-3)">{dict.filters.sortBy}:&nbsp;</span>
            <div className="relative inline-flex items-center">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                aria-label={dict.filters.sortBy}
                className="cursor-pointer appearance-none border-0 bg-transparent py-1 pe-2 ps-0 font-medium text-ink outline-none focus-visible:underline"
              >
                <option value="default">{dict.filters.sortFeatured}</option>
                <option value="newest">{dict.filters.sortNewest}</option>
                <option value="price-asc">{dict.filters.sortPriceAsc}</option>
                <option value="price-desc">{dict.filters.sortPriceDesc}</option>
                <option value="name">{dict.filters.sortName}</option>
              </select>
              <span className="pointer-events-none absolute inset-e-0 text-(--ink-3)">
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 3.5l3 3 3-3" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ColumnsToggle cols={cols} onChange={setCols} lang={lang} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-(--ink-3)">{dict.collections.listEmpty}</p>
      ) : (
        <div
          className={`grid gap-5 sm:gap-6 lg:gap-7 ${
            cols === 1
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
          }`}
        >
          {filtered.map((collection) => (
            <SectionCard key={collection.id} kind="collection" data={collection} lang={lang} dict={dict} />
          ))}
        </div>
      )}

      <MobileFilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        lang={lang}
        dict={dict}
        q=""
        setQ={() => {}}
        category={categoryId}
        setCategory={setCategoryId}
        priceRange={{ min: "", max: "" }}
        setPriceRange={() => {}}
        categoryTree={categoryTree}
        categories={activeCategories}
        openParents={{}}
        toggleParent={() => {}}
        showSearch={false}
        showPrice={false}
        onClear={() => {
          setCategoryId(undefined);
          setPillCategoryIds([]);
        }}
      />
    </div>
  );
}
