"use client";

import type { Language } from "@capella/shared";
import type { Sort } from "../../../types/product-grid.types";
import { ColumnsToggle, type Cols } from "@/components/ui/columns-toggle";

interface ProductGridToolbarProps {
  lang: Language;
  dict: any;
  filteredCount: number;
  hasActiveFilters: boolean;
  sort: Sort;
  cols: Cols;
  onColsChange: (cols: Cols) => void;
  onOpenFilters: () => void;
  onSortChange: (sort: Sort) => void;
}

export function ProductGridToolbar({
  lang,
  dict,
  filteredCount,
  hasActiveFilters,
  sort,
  cols,
  onColsChange,
  onOpenFilters,
  onSortChange
}: ProductGridToolbarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-y-3 border-b border-(--hairline) pb-3.5">
      {/* Left: All Filters (bordered) + borderless Sort dropdown — Bath & Body Works layout. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <button
          onClick={onOpenFilters}
          className={`inline-flex h-9.5 items-center gap-2 rounded-md border px-2 text-sm font-medium transition-colors ${
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

        {/* Sort by: <value> ⌄ — borderless inline dropdown */}
        <div className="relative inline-flex items-center text-sm text-ink border border-(--hairline-strong) px-2 py-1 rounded-md">
          <span className="pointer-events-none text-(--ink-3)">{dict.filters.sortBy}:&nbsp;</span>
          <div className="relative inline-flex items-center">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as Sort)}
              aria-label={dict.filters.sortBy}
              className="cursor-pointer appearance-none border-0 bg-transparent py-1 pe-4 ps-0 font-medium text-ink outline-none focus-visible:underline"
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

      {/* Right: POV column toggle + muted item count */}
      <div className="flex items-center gap-2">
        <ColumnsToggle cols={cols} onChange={onColsChange} lang={lang} />
      </div>
    </div>
  );
}
