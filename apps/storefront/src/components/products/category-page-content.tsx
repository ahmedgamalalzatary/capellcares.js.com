"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickLang, type Category, type Language, type Product } from "@capella/shared";

import { ProductGrid } from "./grid/product-grid";
import { NavArrow } from "@/components/ui/nav-arrow";

export function CategoryPageContent({
  category,
  subCats,
  products,
  categories,
  categoryLookupCategories,
  lang,
  dict
}: {
  category: Category;
  subCats: Category[];
  products: Product[];
  categories: Category[];
  categoryLookupCategories: Category[];
  lang: Language;
  dict: any;
}) {
  const [headerCategoryIds, setHeaderCategoryIds] = useState<number[]>([]);

  const pillGroupRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = pillGroupRef.current;
    if (!el) return;
    // scrollLeft is negative in RTL; use absolute distance from the start edge.
    const start = Math.abs(el.scrollLeft);
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(start > 1);
    setCanScrollNext(maxScroll - start > 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = pillGroupRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState, subCats.length]);

  const scrollPills = (direction: "prev" | "next") => {
    const el = pillGroupRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.75, 200);
    const rtl = getComputedStyle(el).direction === "rtl";
    const sign = direction === "next" ? 1 : -1;
    el.scrollBy({ left: sign * amount * (rtl ? -1 : 1), behavior: "smooth" });
  };

  const toggleHeaderCategory = (categoryId: number) => {
    setHeaderCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  return (
    <>
      {subCats.length > 0 && (
        <div className="pill-group-wrap mt-3">
          {/* mb-4 lines the arrows up with .pill-group's own bottom spacing. */}
          <NavArrow
            direction="prev"
            isRtl={lang === "ar"}
            className="mb-4"
            aria-label={dict.common?.previous ?? "Previous"}
            onClick={() => scrollPills("prev")}
            disabled={!canScrollPrev}
          />
          <div className="pill-group" ref={pillGroupRef}>
            {subCats.map((item) => {
              const active = headerCategoryIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={active ? "filter-pill filter-pill--active" : "filter-pill"}
                  aria-pressed={active}
                  onClick={() => toggleHeaderCategory(item.id)}
                >
                  {pickLang(item.name, lang)}
                  {active && (
                    <span className="filter-pill__x" aria-hidden="true">
                      X
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <NavArrow
            direction="next"
            isRtl={lang === "ar"}
            className="mb-4"
            aria-label={dict.common?.next ?? "Next"}
            onClick={() => scrollPills("next")}
            disabled={!canScrollNext}
          />
        </div>
      )}
      <ProductGrid
        products={products}
        categories={categories}
        categoryLookupCategories={categoryLookupCategories}
        lang={lang}
        dict={dict}
        initialCategory={category.id}
        scopedCategoryId={category.id}
        initialCols={2}
        lockCategory={false}
        headerCategoryIds={headerCategoryIds}
        onHeaderCategoryIdsChange={setHeaderCategoryIds}
      />
    </>
  );
}
