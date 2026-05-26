"use client";

import type { Category, Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { CategoryPill } from "./category-pill";
import { FilterSection } from "./filter-section";
import type { CategoryTreeItem, PriceRange } from "./product-grid.types";
import { ProductFilterCategoryList } from "./product-filter-category-list";
import { PriceInput } from "./price-input";

interface ProductFiltersContentProps {
  lang: Language;
  dict: any;
  q: string;
  setQ: (value: string) => void;
  category: number | undefined;
  setCategory: (value: number | undefined) => void;
  priceRange: PriceRange;
  setPriceRange: React.Dispatch<React.SetStateAction<PriceRange>>;
  categoryTree: CategoryTreeItem[];
  categories: Category[];
  openParents: Record<number, boolean>;
  toggleParent: (id: number) => void;
  lockCategory?: boolean;
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
  mode
}: ProductFiltersContentProps) {
  const isAr = lang === "ar";
  const isMobile = mode === "mobile";

  return (
    <>
      <FilterSection label={dict.nav.search} defaultOpen dark>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "oklch(1 0 0 / 0.06)",
            border: "1px solid oklch(1 0 0 / 0.12)",
            borderRadius: "var(--radius)",
            padding: "9px 14px"
          }}
        >
          <Icon.Search size={14} style={{ flexShrink: 0, color: "oklch(0.94 0.06 85 / 0.4)" }} />
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
              color: "oklch(0.97 0.03 85)"
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
                background: "oklch(1 0 0 / 0.1)",
                border: 0,
                color: "oklch(0.94 0.06 85 / 0.7)",
                cursor: "pointer",
                flexShrink: 0
              }}
            >
              <Icon.Close size={9} />
            </button>
          )}
        </div>
      </FilterSection>

      {!lockCategory && (
        <FilterSection label={dict.filters.category} defaultOpen dark>
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

      <FilterSection label={dict.filters.price} defaultOpen={false} dark>
        <div style={{ display: "grid", gap: 8 }}>
          <PriceInput value={priceRange.min} onChange={(value) => setPriceRange((state) => ({ ...state, min: value }))} placeholder={dict.filters.priceMin} lang={lang} dark />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
            <span style={{ fontSize: "10px", color: "oklch(0.94 0.06 85 / 0.35)", letterSpacing: "0.1em", fontWeight: 600 }}>
              {dict.filters.to}
            </span>
            <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
          </div>
          <PriceInput value={priceRange.max} onChange={(value) => setPriceRange((state) => ({ ...state, max: value }))} placeholder={dict.filters.priceMax} lang={lang} dark />
        </div>
      </FilterSection>
    </>
  );
}
