"use client";

import { useMemo, useState } from "react";
import { pickLang } from "@capella/shared";
import { ProductCard } from "../product-card";
import { FilterDrawer } from "../filters/filter-drawer";
import { ProductGridEmptyState } from "./product-grid-empty-state";
import { ProductGridToolbar } from "./product-grid-toolbar";
import type { AttributeFilterGroup, ProductGridProps } from "../../../types/product-grid.types";
import { useProductGridFilters } from "../../../hooks/use-product-grid-filters";
import { useProductAttributes } from "@/components/providers/product-attributes-provider";
import type { Cols } from "@/components/ui/columns-toggle";

/* ─── Main ProductGrid ─── */
export function ProductGrid({
  products,
  categories,
  categoryLookupCategories,
  lang,
  dict,
  initialSearch = "",
  initialCategory,
  initialCols = 2,
  lockCategory,
  headerCategoryIds,
  onHeaderCategoryIdsChange,
  scopedCategoryId,
  hiddenAttributeFilters = []
}: ProductGridProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [cols, setCols] = useState<Cols>(initialCols);

  const categoryNameById = useMemo(
    () => new Map((categoryLookupCategories ?? categories).map((c) => [c.id, pickLang(c.name, lang)] as const)),
    [categories, categoryLookupCategories, lang]
  );

  const {
    q,
    setQ,
    category,
    setCategory,
    sort,
    setSort,
    priceRange,
    setPriceRange,
    attributeFilters,
    toggleAttributeFilter,
    categoryTree,
    openParents,
    toggleParent,
    filtered,
    handleClear,
    hasActiveFilters
  } = useProductGridFilters({
    products,
    categories,
    categoryLookupCategories,
    lang,
    initialSearch,
    initialCategory,
    headerCategoryIds,
    onHeaderCategoryIdsChange
  });

  const { brands, characters, ageGroups } = useProductAttributes();
  // Only choices some product in this list has, so picking one never empties the page.
  const groups: AttributeFilterGroup[] = [
    { key: "brand" as const, label: dict.filters.brand, items: brands, used: new Set(products.map((p) => p.brandId)) },
    { key: "age" as const, label: dict.filters.age, items: ageGroups, used: new Set(products.flatMap((p) => p.ageGroupIds ?? [])) },
    { key: "character" as const, label: dict.filters.character, items: characters, used: new Set(products.flatMap((p) => p.characterIds ?? [])) }
  ]
    .filter(({ key }) => !hiddenAttributeFilters.includes(key))
    .map(({ key, label, items, used }) => ({
      key,
      label,
      options: items.filter((item) => used.has(item.id)).map((item) => ({ id: item.id, label: pickLang(item.name, lang) })),
      selected: attributeFilters[key],
      toggle: (id: number) => toggleAttributeFilter(key, id)
    }))
    .filter((group) => group.options.length > 0);

  const sharedFilterProps = {
    attributeGroups: groups,
    lang,
    dict,
    q,
    setQ,
    category,
    setCategory,
    priceRange,
    setPriceRange,
    categoryTree,
    categories,
    openParents,
    toggleParent,
    lockCategory,
    scopedCategoryId,
    onClear: handleClear,
  };

  return (
    <div className="grid gap-9">
      {/* ── Product area ── */}
      <div className="min-w-0">
        <ProductGridToolbar
          lang={lang}
          dict={dict}
          hasActiveFilters={hasActiveFilters}
          sort={sort}
          cols={cols}
          onColsChange={setCols}
          onOpenFilters={() => setShowFilters(true)}
          onSortChange={setSort}
        />

        {/* Empty state */}
        {filtered.length === 0 ? (
          <ProductGridEmptyState
            lang={lang}
            dict={dict}
            hasActiveFilters={hasActiveFilters}
            onClear={handleClear}
          />
        ) : (
          <div
            data-cols={cols}
            className={`group/cards grid gap-4 md:gap-6 lg:gap-7 ${
              cols === 1
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                lang={lang}
                dict={dict}
                categoryName={categoryNameById.get(product.categoryId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile drawer ── */}
      <FilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        {...sharedFilterProps}
      />
    </div>
  );
}
