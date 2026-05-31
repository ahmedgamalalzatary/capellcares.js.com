"use client";

import type { Sort } from "../../../types/product-grid.types";

interface ProductGridToolbarProps {
  dict: any;
  filteredCount: number;
  hasActiveFilters: boolean;
  sort: Sort;
  onOpenFilters: () => void;
  onSortChange: (sort: Sort) => void;
}

export function ProductGridToolbar({
  dict,
  filteredCount,
  hasActiveFilters,
  sort,
  onOpenFilters,
  onSortChange
}: ProductGridToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px 16px",
        borderBottom: "1px solid var(--hairline)",
        paddingBottom: "14px",
        marginBottom: "24px"
      }}
    >
      <button
        onClick={onOpenFilters}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 38,
          paddingInline: 16,
          borderRadius: "var(--radius-pill)",
          background: hasActiveFilters ? "var(--accent)" : "var(--surface)",
          border: hasActiveFilters ? "1px solid var(--accent)" : "1px solid var(--hairline)",
          color: hasActiveFilters ? "var(--canvas)" : "var(--ink)",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 160ms, border-color 160ms, color 160ms",
          boxShadow: hasActiveFilters ? "var(--shadow-1)" : "none"
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {dict.common.filters}
        {hasActiveFilters && (
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "oklch(1 0 0 / 0.25)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: 700,
              lineHeight: 1
            }}
          >
            •
          </span>
        )}
      </button>

      <span
        style={{
          fontSize: "13px",
          color: "var(--ink-3)",
          letterSpacing: "0.01em",
          order: 3,
          flex: "0 0 100%"
        }}
        className="sm:order-0 sm:flex-[0_0_auto]"
      >
        {dict.common.results.replace("{n}", String(filteredCount))}
      </span>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "var(--ink-3)",
            letterSpacing: "0.04em",
            fontWeight: 500
          }}
          className="hidden sm:inline"
        >
          {dict.filters.sortBy}
        </span>
        <div style={{ position: "relative" }}>
          <select
            className="select"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as Sort)}
            style={{
              height: 36,
              paddingBlock: 0,
              paddingInlineStart: "12px",
              paddingInlineEnd: "32px",
              fontSize: "13px",
              borderRadius: "var(--radius-pill)",
              appearance: "none",
              WebkitAppearance: "none",
              cursor: "pointer"
            }}
          >
            <option value="newest">{dict.filters.sortNewest}</option>
            <option value="price-asc">{dict.filters.sortPriceAsc}</option>
            <option value="price-desc">{dict.filters.sortPriceDesc}</option>
            <option value="name">{dict.filters.sortName}</option>
          </select>
          <span
            style={{
              position: "absolute",
              insetInlineEnd: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--ink-3)"
            }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M2 3.5l3 3 3-3" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
