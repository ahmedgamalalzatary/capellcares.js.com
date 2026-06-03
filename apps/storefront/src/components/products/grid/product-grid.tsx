"use client";

import { useState } from "react";
import { ProductCard } from "../product-card";
import { MobileFilterDrawer } from "../filters/mobile-filter-drawer";
import { ProductGridEmptyState } from "./product-grid-empty-state";
import { ProductGridToolbar } from "./product-grid-toolbar";
import type { ProductGridProps } from "../../../types/product-grid.types";
import { useProductGridFilters } from "../../../hooks/use-product-grid-filters";

/* ─── Main ProductGrid ─── */
export function ProductGrid({
  products,
  categories,
  lang,
  dict,
  initialSearch = "",
  initialCategory,
  lockCategory,
}: ProductGridProps) {
  const [showFilters, setShowFilters] = useState(false);

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
    initialCategory
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
    <div className="grid gap-9 pb-20">
      {/* ── Product area ── */}
      <div className="min-w-0">
        <ProductGridToolbar
          dict={dict}
          filteredCount={filtered.length}
          hasActiveFilters={hasActiveFilters}
          sort={sort}
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
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] lg:gap-7">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
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
