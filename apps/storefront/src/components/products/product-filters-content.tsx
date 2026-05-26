"use client";

import { pickLang, type Category, type Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { CategoryPill } from "./category-pill";
import { FilterSection } from "./filter-section";
import type { CategoryTreeItem, PriceRange } from "./product-grid.types";
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
          {isMobile ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <CategoryPill name="cat-mobile" checked={!category} onChange={() => setCategory(undefined)}>
                {dict.nav.allCategories}
              </CategoryPill>

              {categoryTree.length > 0
                ? categoryTree.map(({ parent, children }) => {
                    const isOpen =
                      openParents[parent.id] ??
                      Boolean(category && (category === parent.id || children.some((item) => item.id === category)));

                    return (
                      <div key={parent.id} style={{ display: "contents" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <CategoryPill name="cat-mobile" checked={category === parent.id} onChange={() => setCategory(parent.id)}>
                            {pickLang(parent.name, lang)}
                          </CategoryPill>
                          {children.length > 0 && (
                            <button
                              type="button"
                              aria-label={isAr ? "تبديل الفئة" : "Toggle category"}
                              aria-expanded={isOpen}
                              onClick={() => toggleParent(parent.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                border: "1px solid oklch(1 0 0 / 0.14)",
                                background: isOpen ? "oklch(1 0 0 / 0.1)" : "transparent",
                                color: "oklch(0.94 0.06 85 / 0.5)",
                                cursor: "pointer",
                                transition: "background 160ms"
                              }}
                            >
                              <svg
                                width="8"
                                height="8"
                                viewBox="0 0 10 10"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                style={{
                                  transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)",
                                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"
                                }}
                              >
                                <path d="M3 2l4 3-4 3" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {children.length > 0 && isOpen && children.map((child) => (
                          <CategoryPill key={child.id} name="cat-mobile" checked={category === child.id} onChange={() => setCategory(child.id)} indent>
                            {pickLang(child.name, lang)}
                          </CategoryPill>
                        ))}
                      </div>
                    );
                  })
                : categories.slice(0, 14).map((item) => (
                    <CategoryPill key={item.id} name="cat-mobile" checked={category === item.id} onChange={() => setCategory(item.id)}>
                      {pickLang(item.name, lang)}
                    </CategoryPill>
                  ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                maxHeight: "260px",
                overflowY: "auto",
                paddingInlineEnd: "2px",
                scrollbarWidth: "thin",
                scrollbarColor: "oklch(1 0 0 / 0.1) transparent"
              }}
            >
              <CategoryPill name="cat" checked={!category} onChange={() => setCategory(undefined)}>
                {dict.nav.allCategories}
              </CategoryPill>

              {categoryTree.length > 0
                ? categoryTree.map(({ parent, children }) => {
                    const isOpen =
                      openParents[parent.id] ??
                      Boolean(category && (category === parent.id || children.some((item) => item.id === category)));

                    return (
                      <div key={parent.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <CategoryPill name="cat" checked={category === parent.id} onChange={() => setCategory(parent.id)}>
                              {pickLang(parent.name, lang)}
                            </CategoryPill>
                          </div>
                          {children.length > 0 && (
                            <button
                              type="button"
                              aria-label={isAr ? "تبديل الفئة" : "Toggle category"}
                              aria-expanded={isOpen}
                              onClick={() => toggleParent(parent.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                border: "1px solid oklch(1 0 0 / 0.14)",
                                background: isOpen ? "oklch(1 0 0 / 0.1)" : "transparent",
                                color: "oklch(0.94 0.06 85 / 0.5)",
                                cursor: "pointer",
                                flexShrink: 0,
                                transition: "background 160ms"
                              }}
                            >
                              <svg
                                width="8"
                                height="8"
                                viewBox="0 0 10 10"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                style={{
                                  transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)",
                                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"
                                }}
                              >
                                <path d="M3 2l4 3-4 3" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {children.length > 0 && isOpen && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {children.map((child) => (
                              <CategoryPill key={child.id} name="cat" checked={category === child.id} onChange={() => setCategory(child.id)} indent>
                                {pickLang(child.name, lang)}
                              </CategoryPill>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                : categories.slice(0, 14).map((item) => (
                    <CategoryPill key={item.id} name="cat" checked={category === item.id} onChange={() => setCategory(item.id)}>
                      {pickLang(item.name, lang)}
                    </CategoryPill>
                  ))}
            </div>
          )}
        </FilterSection>
      )}

      <FilterSection label={dict.filters.price} defaultOpen={false} dark>
        <div style={{ display: "grid", gap: 8 }}>
          <PriceInput value={priceRange.min} onChange={(value) => setPriceRange((state) => ({ ...state, min: value }))} placeholder={dict.filters.priceMin} lang={lang} dark />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
            <span style={{ fontSize: "10px", color: "oklch(0.94 0.06 85 / 0.35)", letterSpacing: "0.1em", fontWeight: 600 }}>
              {isAr ? "إلى" : "TO"}
            </span>
            <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
          </div>
          <PriceInput value={priceRange.max} onChange={(value) => setPriceRange((state) => ({ ...state, max: value }))} placeholder={dict.filters.priceMax} lang={lang} dark />
        </div>
      </FilterSection>
    </>
  );
}
