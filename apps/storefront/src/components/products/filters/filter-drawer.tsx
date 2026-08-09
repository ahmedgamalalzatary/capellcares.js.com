"use client";

import { useEffect, useRef } from "react";
import type { Category, Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ProductFiltersContent } from "./product-filters-content";
import type { CategoryTreeNode, PriceRange } from "../../../types/product-grid.types";

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
  onClear
}: FilterDrawerProps) {
  const isAr = lang === "ar";
  const closeLabel = dict.filters.closeFilters ?? "Close filters";
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Whatever opened the drawer gets focus back when it closes.
  const triggerRef = useRef<HTMLElement | null>(null);

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
        // Distinct from the close button's label — naming both the same would
        // read as two identical controls to a screen reader.
        aria-label={dict.filters.dismissFilters ?? "Dismiss filters"}
        tabIndex={open ? 0 : -1}
        inert={!open}
        className={cn(
          "fixed inset-0 z-50 cursor-pointer border-0 p-0 bg-[oklch(0.22_0.04_45_/_0.45)] backdrop-blur-[4px] transition-opacity duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={dict.filters.title}
        // The drawer stays mounted so it can slide; `inert` keeps the off-screen
        // copy out of the tab order and the accessibility tree meanwhile.
        inert={!open}
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
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="mb-[2px] inline-flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--hairline) bg-surface text-(--ink-3) transition-[background] duration-[160ms]"
            aria-label={closeLabel}
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
            scopedCategoryId={scopedCategoryId}
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
