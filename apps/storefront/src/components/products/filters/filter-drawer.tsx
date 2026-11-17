"use client";

import { useEffect, useRef } from "react";
import type { Category, Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ProductFiltersContent } from "./product-filters-content";
import type { AttributeFilterGroup, CategoryTreeNode, PriceRange } from "../../../types/product-grid.types";

interface FilterDrawerProps {
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
  scopedCategoryId?: number;
  onClear: () => void;
  attributeGroups?: AttributeFilterGroup[];
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];
}

export function FilterDrawer({
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
  scopedCategoryId,
  onClear,
  attributeGroups
}: FilterDrawerProps) {
  const isAr = lang === "ar";
  const closeLabel = dict.filters.closeFilters ?? "Close filters";
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Whatever opened the drawer gets focus back when it closes.
  const triggerRef = useRef<HTMLElement | null>(null);

  // Lock <html> as well as <body>: phones scroll the document element, so a body-only lock lets a finger drag the page under the drawer. Same non-shifting lock as the menu and search screen; restores what was there before so an outer lock survives.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    const previousOverflow = html.style.overflow;
    const previousPaddingRight = html.style.paddingRight;
    const previousBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) html.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousOverflow;
      html.style.paddingRight = previousPaddingRight;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      triggerRef.current?.focus();
      triggerRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableWithin(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      const escapesForward = !event.shiftKey && (active === last || !dialogRef.current?.contains(active));
      const escapesBackward = event.shiftKey && (active === first || !dialogRef.current?.contains(active));

      if (escapesForward) {
        event.preventDefault();
        first.focus();
      } else if (escapesBackward) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        // Distinct from the close button's label — naming both the same would read as two identical controls to a screen reader.
        aria-label={dict.filters.dismissFilters ?? "Dismiss filters"}
        tabIndex={open ? 0 : -1}
        inert={!open}
        className={cn(
          "fixed inset-0 z-100 cursor-pointer touch-none border-0 p-0 bg-[rgb(36_18_63_/_0.45)] backdrop-blur-[4px] transition-opacity duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={dict.filters.title}
        // The drawer stays mounted so it can slide; `inert` keeps the off-screen copy out of the tab order and the accessibility tree meanwhile.
        inert={!open}
        className={cn(
          "fixed inset-y-0 start-0 z-101 flex w-[min(340px,90vw)] flex-col overflow-y-auto overscroll-contain bg-(--page-bg) transition-transform duration-[320ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "translate-x-0" : isAr ? "translate-x-full" : "-translate-x-full"
        )}
      >
        <div className="sticky top-0 z-[2] flex shrink-0 items-end justify-between gap-3 border-b border-(--hairline) bg-(--page-bg) px-5 pt-5 pb-4">
          <div>
            <span
              className={cn(
                "block leading-[1.05] text-ink",
                isAr
                  ? "font-(family-name:--font-ar) text-[20px] font-bold "
                  : "font-extrabold text-[24px] "
              )}
            >
              {dict.filters.title}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="mb-[2px] inline-flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-surface text-ink transition-[background] duration-[160ms]"
            aria-label={closeLabel}
          >
            <Icon.Close size={14} className="stroke-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain bg-(--page-bg) px-5">
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
            scopedCategoryId={scopedCategoryId}
            attributeGroups={attributeGroups}
            mode="mobile"
          />
        </div>

        <div className="sticky bottom-0 z-[2] flex shrink-0 gap-[10px] border-t border-(--hairline) bg-(--page-bg) px-5 py-4">
          <button onClick={onClear} className="btn btn--main btn--sm flex-1">
            {dict.common.clear}
          </button>
          <button onClick={onClose} className="btn btn--main btn--primary btn--sm flex-[2]">
            {dict.filters.showResults ?? "Show results"}
          </button>
        </div>
      </div>
    </>
  );
}
