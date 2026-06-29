"use client";

import { useEffect } from "react";
import type { Category, Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
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
        style={{
          position: "fixed",
          inset: 0,
          border: 0,
          padding: 0,
          background: "oklch(0.22 0.04 45 / 0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 50,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          cursor: "pointer",
          transition: "opacity 280ms cubic-bezier(0.16,1,0.3,1)"
        }}
      />

      <div
        style={{
          position: "fixed",
          insetBlockStart: 0,
          insetBlockEnd: 0,
          insetInlineStart: 0,
          width: "min(340px, 90vw)",
          background: "var(--canvas)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : isAr ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 320ms cubic-bezier(0.16,1,0.3,1)",
          overflowY: "auto"
        }}
      >
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid var(--hairline)",
            background: "var(--canvas)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 2
          }}
        >
          <div>
            <p style={{ margin: "0 0 1px", fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 700, opacity: 0.8 }}>
              {dict.brand}
            </p>
            <span
              style={{
                fontFamily: isAr ? "var(--font-ar)" : "var(--font-display)",
                fontWeight: isAr ? 700 : 400,
                fontSize: isAr ? "20px" : "24px",
                color: "var(--ink)",
                letterSpacing: isAr ? "-0.01em" : "-0.02em",
                lineHeight: 1.05,
                display: "block"
              }}
            >
              {dict.filters.title}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid var(--hairline)",
              background: "var(--surface)",
              color: "var(--ink-3)",
              cursor: "pointer",
              transition: "background 160ms",
              flexShrink: 0,
              marginBottom: "2px"
            }}
            aria-label={dict.filters.closeFilters ?? "Close filters"}
          >
            <Icon.Close size={13} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", background: "var(--canvas)" }}>
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

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--hairline)",
            display: "flex",
            gap: 10,
            flexShrink: 0,
            position: "sticky",
            bottom: 0,
            background: "var(--canvas)",
            zIndex: 2
          }}
        >
          <button onClick={onClear} className="btn btn--sm" style={{ flex: 1 }}>
            {dict.common.clear}
          </button>
          <button onClick={onClose} className="btn btn--primary btn--sm" style={{ flex: 2 }}>
            {dict.filters.showResults ?? "Show results"}
          </button>
        </div>
      </div>
    </>
  );
}
