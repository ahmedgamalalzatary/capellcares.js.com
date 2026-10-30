"use client";

import type { Category, Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { FilterSection } from "./filter-section";
import type { AttributeFilterGroup, CategoryTreeNode, PriceRange } from "../../../types/product-grid.types";
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
  scopedCategoryId?: number;
  attributeGroups?: AttributeFilterGroup[];
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
  scopedCategoryId,
  attributeGroups = [],
  mode
}: ProductFiltersContentProps) {
  const isMobile = mode === "mobile";

  return (
    <>
      {showSearch && (
      <FilterSection label={dict.nav.search} defaultOpen>
        <div className="flex items-center gap-[10px] rounded-(--radius) border border-(--hairline) bg-surface px-[14px] py-[9px]">
          <Icon.Search size={14} className="shrink-0 text-(--ink-3)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={dict.nav.search}
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent text-(--text) outline-none",
              isMobile ? "text-[14px]" : "text-[13.5px]"
            )}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="inline-flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-(--warm-soft) text-(--ink-3)"
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
            scopedCategoryId={scopedCategoryId}
          />
        </FilterSection>
      )}

      {attributeGroups.map((group) => (
        <FilterSection key={group.key} label={group.label} defaultOpen>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const active = group.selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => group.toggle(option.id)}
                  className={active ? "filter-pill filter-pill--active" : "filter-pill"}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </FilterSection>
      ))}

      {showPrice && (
      <FilterSection label={dict.filters.price} defaultOpen={false}>
        {/* `[display:grid]`, not `grid`: the global `.grid` class carries its own
            24px gap that would override the utility below. */}
        <div className="[display:grid] gap-2">
          <PriceInput value={priceRange.min} onChange={(value) => setPriceRange((state) => ({ ...state, min: value }))} placeholder={dict.filters.priceMin} lang={lang} />
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-(--hairline)" />
            <span className="text-[10px] font-semibold text-(--ink-3)">
              {dict.filters.to}
            </span>
            <div className="h-px flex-1 bg-(--hairline)" />
          </div>
          <PriceInput value={priceRange.max} onChange={(value) => setPriceRange((state) => ({ ...state, max: value }))} placeholder={dict.filters.priceMax} lang={lang} />
        </div>
      </FilterSection>
      )}
    </>
  );
}
