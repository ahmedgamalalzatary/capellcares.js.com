"use client";

import { useEffect } from "react";
import type { Category, Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ProductFiltersContent } from "./product-filters-content";
import type { CategoryTreeNode, PriceRange } from "../../../types/product-grid.types";

interface MobileFilterDrawerProps {
  open: boolean;
  onClose: () => void;
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
  onClear: () => void;
}

export function MobileFilterDrawer({
  open,
  onClose,
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
  showSearch,
  showPrice,
  onClear
}: MobileFilterDrawerProps) {
  const isAr = lang === "ar";

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 cursor-pointer border-0 p-0 bg-[oklch(0.22_0.04_45_/_0.45)] backdrop-blur-[4px] transition-opacity duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <div
        className={cn(
          "fixed inset-y-0 start-0 z-[51] flex w-[min(340px,90vw)] flex-col overflow-y-auto bg-canvas transition-transform duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : isAr ? "translate-x-full" : "-translate-x-full"
        )}
      >
        <div className="sticky top-0 z-[2] flex shrink-0 items-end justify-between gap-3 border-b border-(--hairline) bg-canvas px-5 pt-5 pb-4">
          <div>
            <p className="mx-0 mt-0 mb-px text-[9px] font-bold tracking-[0.22em] uppercase text-(--ink-3) opacity-80">
              {dict.brand}
            </p>
            <span
              className={cn(
                "block leading-[1.05] text-ink",
                isAr
                  ? "font-(family-name:--font-ar) text-[20px] font-bold tracking-[-0.01em]"
                  : "font-(family-name:--font-display) text-[24px] font-normal tracking-[-0.02em]"
              )}
            >
              {dict.filters.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="mb-[2px] inline-flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--hairline) bg-surface text-(--ink-3) transition-[background] duration-[160ms]"
            aria-label={dict.filters.closeFilters ?? "Close filters"}
          >
            <Icon.Close size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-canvas px-5">
          <ProductFiltersContent
            lang={lang}
            dict={dict}
            q={q}
            setQ={setQ}
            category={category}
            setCategory={setCategory}
            priceRange={priceRange}
            setPriceRange={setPriceRange}
            categoryTree={categoryTree}
            categories={categories}
            openParents={openParents}
            toggleParent={toggleParent}
            lockCategory={lockCategory}
            showSearch={showSearch}
            showPrice={showPrice}
            mode="mobile"
          />
        </div>

        <div className="sticky bottom-0 z-[2] flex shrink-0 gap-[10px] border-t border-(--hairline) bg-canvas px-5 py-4">
          <button onClick={onClear} className="btn btn--sm flex-1">
            {dict.common.clear}
          </button>
          <button onClick={onClose} className="btn btn--primary btn--sm flex-[2]">
            {dict.filters.showResults ?? "Show results"}
          </button>
        </div>
      </div>
    </>
  );
}
