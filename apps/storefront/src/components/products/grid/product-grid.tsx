"use client";

import { useMemo, useState } from "react";
import { pickLang } from "@capella/shared";
import { ProductCard } from "../product-card";
import { MobileFilterDrawer } from "../filters/mobile-filter-drawer";
import { ProductGridEmptyState } from "./product-grid-empty-state";
import { ProductGridToolbar } from "./product-grid-toolbar";
import type { ProductGridProps } from "../../../types/product-grid.types";
import { useProductGridFilters } from "../../../hooks/use-product-grid-filters";
import type { Cols } from "@/components/ui/columns-toggle";

/* ─── Main ProductGrid ─── */
export function ProductGrid({
  products,
  categories,
  lang,
  dict,
  initialSearch = "",
  initialCategory,
  initialCols = 1,
  lockCategory,
  headerCategoryIds,
  onHeaderCategoryIdsChange
}: ProductGridProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [cols, setCols] = useState<Cols>(initialCols);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, pickLang(c.name, lang)] as const)),
    [categories, lang]
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
    categoryTree,
    openParents,
    toggleParent,
    filtered,
    handleClear,
    hasActiveFilters
  } = useProductGridFilters({
    products,
    categories,
    lang,
    initialSearch,
    initialCategory,
    headerCategoryIds,
    onHeaderCategoryIdsChange
  });

  const sharedFilterProps = {
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
    onClear: handleClear,
  };

  return (
    <div className="grid gap-9">
      {/* ── Product area ── */}
      <div className="min-w-0">
        <ProductGridToolbar
          lang={lang}
          dict={dict}
          filteredCount={filtered.length}
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
      <MobileFilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        {...sharedFilterProps}
      />
    </div>
  );
}
