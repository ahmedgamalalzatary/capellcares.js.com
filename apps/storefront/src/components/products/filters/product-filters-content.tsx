"use client";

import type { Category, Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { FilterSection } from "./filter-section";
import type { CategoryTreeNode, PriceRange } from "../../../types/product-grid.types";
import { ProductFilterCategoryList } from "./product-filter-category-list";
import { PriceInput } from "../price-input";

interface ProductFiltersContentProps {
  lang: Language;
  dict: any;
  q: string;
  setQ: (value: string) => void;
  category: number | undefined;
  setCategory: (value: number | undefined) => void;
  priceRange: PriceRange;
  setPriceRange: React.Dispatch<React.SetStateAction<PriceRange>>;
  categoryTree: CategoryTreeNode[];
  categories: Category[];
  openParents: Record<number, boolean>;
  toggleParent: (id: number) => void;
  lockCategory?: boolean;
  showSearch?: boolean;
  showPrice?: boolean;
  mode: "mobile" | "desktop";
}

export function ProductFiltersContent({
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
  showSearch = true,
  showPrice = true,
  mode
}: ProductFiltersContentProps) {
  const isMobile = mode === "mobile";

  return (
    <>
      {showSearch && (
      <FilterSection label={dict.nav.search} defaultOpen>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--radius)",
            padding: "9px 14px"
          }}
        >
          <Icon.Search size={14} style={{ flexShrink: 0, color: "var(--ink-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.nav.search}
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              background: "transparent",
              outline: "none",
              fontSize: isMobile ? "14px" : "13.5px",
              color: "var(--text)"
            }}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "oklch(0 0 0 / 0.08)",
                border: 0,
                color: "var(--ink-3)",
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              <Icon.Close size={9} />
            </button>
          )}
        </div>
      </FilterSection>
      )}

      {!lockCategory && (
        <FilterSection label={dict.filters.bytype} defaultOpen>
          <ProductFilterCategoryList
            mode={mode}
            lang={lang}
            dict={dict}
            category={category}
            setCategory={setCategory}
            categories={categories}
            categoryTree={categoryTree}
            openParents={openParents}
            toggleParent={toggleParent}
          />
        </FilterSection>
      )}

      {showPrice && (
      <FilterSection label={dict.filters.price} defaultOpen={false}>
        <div style={{ display: "grid", gap: 8 }}>
          <PriceInput value={priceRange.min} onChange={(value) => setPriceRange((state) => ({ ...state, min: value }))} placeholder={dict.filters.priceMin} lang={lang} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: "1px", background: "var(--hairline)" }} />
            <span style={{ fontSize: "10px", color: "var(--ink-3)", letterSpacing: "0.1em", fontWeight: 600 }}>
              {dict.filters.to}
            </span>
            <div style={{ flex: 1, height: "1px", background: "var(--hairline)" }} />
          </div>
          <PriceInput value={priceRange.max} onChange={(value) => setPriceRange((state) => ({ ...state, max: value }))} placeholder={dict.filters.priceMax} lang={lang} />
        </div>
      </FilterSection>
      )}
    </>
  );
}
