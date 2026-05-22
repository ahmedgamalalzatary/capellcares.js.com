"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { pickLang, type Language, type Product, type Category } from "@capella/shared";
import { ProductCard } from "./product-card";
import { Icon } from "@/components/ui/icons";

interface Props {
  products: Product[];
  categories: Category[];
  lang: Language;
  dict: any;
  initialSearch?: string;
  initialCategory?: number;
  lockCategory?: boolean;
}

type Sort = "newest" | "price-asc" | "price-desc" | "name";

function safeName(product: Product, lang: Language): string {
  const fallback = { ar: "", en: "" };
  return pickLang(product.name ?? fallback, lang);
}

function minVariantPrice(product: Product): number {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...variants.map((variant) => Number(variant?.price ?? Number.POSITIVE_INFINITY)));
}

function isDescendantOf(categoryId: number, selectedId: number, byId: Map<number, Category>) {
  let current = byId.get(categoryId);
  while (current?.parentId != null) {
    if (current.parentId === selectedId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

/* ─── Animated collapsible section ─── */
function FilterSection({
  label,
  children,
  defaultOpen = true,
  dark = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!contentRef.current) return;
    let rafId1 = 0;
    let rafId2 = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (open) {
      const h = contentRef.current.scrollHeight;
      setHeight(h);
      setIsAnimating(true);
      timeoutId = setTimeout(() => { setHeight("auto"); setIsAnimating(false); }, 280);
    } else {
      const h = contentRef.current.scrollHeight;
      setHeight(h);
      rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(() => {
          setHeight(0);
          setIsAnimating(true);
          timeoutId = setTimeout(() => setIsAnimating(false), 280);
        });
      });
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      cancelAnimationFrame(rafId1);
      cancelAnimationFrame(rafId2);
    };
  }, [open]);

  const lineColor = dark ? "oklch(1 0 0 / 0.1)" : "var(--hairline)";
  const labelColor = dark ? "oklch(0.94 0.06 85 / 0.5)" : "var(--ink-3)";
  const chevronColor = dark ? "oklch(0.94 0.06 85 / 0.6)" : "var(--ink-3)";

  return (
    <div style={{ borderBottom: `1px solid ${lineColor}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 0",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "start",
        }}
        aria-expanded={open}
      >
        <span
          style={{
            fontSize: "10px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: labelColor,
          }}
        >
          {label}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          fill="none" stroke={chevronColor} strokeWidth="1.8" strokeLinecap="round"
          style={{
            transition: "transform 280ms cubic-bezier(0.16, 1, 0.3, 1)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            flexShrink: 0,
          }}
        >
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      <div
        ref={contentRef}
        style={{
          height: height === "auto" ? "auto" : `${height}px`,
          overflow: isAnimating || height === 0 ? "hidden" : "visible",
          transition: "height 280ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: isAnimating ? "height" : "auto",
        }}
      >
        <div style={{ paddingBottom: "16px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ─── Pill-style category item ─── */
function CategoryPill({
  name,
  checked,
  onChange,
  children,
  indent = false,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        cursor: "pointer",
        marginInlineStart: indent ? "16px" : "0",
      }}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: indent ? 30 : 34,
          paddingInline: "14px",
          borderRadius: "var(--radius)",
          fontSize: indent ? "12px" : "13px",
          fontWeight: checked ? 600 : 400,
          border: checked
            ? "1px solid var(--warm)"
            : "1px solid transparent",
          background: checked
            ? "oklch(0.748 0.106 70 / 0.15)"
            : "transparent",
          color: checked ? "var(--warm)" : "oklch(0.94 0.06 85 / 0.7)",
          transition: "background 180ms, border-color 180ms, color 180ms",
        }}
      >
        {checked && (
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--warm)", marginInlineEnd: 10, flexShrink: 0 }} />
        )}
        {children}
      </span>
    </label>
  );
}

/* ─── Dark price input ─── */
function PriceInput({
  value,
  onChange,
  placeholder,
  lang,
  dark = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  lang: Language;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: dark ? "oklch(1 0 0 / 0.06)" : "var(--surface)",
        border: dark ? "1px solid oklch(1 0 0 / 0.14)" : "1px solid var(--hairline)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        transition: "border-color 180ms, box-shadow 180ms",
      }}
    >
      <span
        style={{
          paddingInlineStart: "12px",
          fontSize: "10.5px",
          letterSpacing: "0.06em",
          color: dark ? "oklch(0.94 0.06 85 / 0.45)" : "var(--ink-3)",
          fontWeight: 600,
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {lang === "ar" ? "ج.م" : "EGP"}
      </span>
      <input
        type="number"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 0,
          background: "transparent",
          outline: "none",
          padding: "9px 12px",
          fontSize: "13px",
          color: dark ? "oklch(0.97 0.03 85)" : "var(--text)",
        }}
      />
    </div>
  );
}

/* ─── Desktop sidebar panel ─── */
function FilterSidebar({
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
  onClear,
  initialCategory,
}: {
  lang: Language;
  dict: any;
  q: string;
  setQ: (v: string) => void;
  category: number | undefined;
  setCategory: (v: number | undefined) => void;
  priceRange: { min: string; max: string };
  setPriceRange: React.Dispatch<React.SetStateAction<{ min: string; max: string }>>;
  categoryTree: { parent: Category; children: Category[] }[];
  categories: Category[];
  openParents: Record<number, boolean>;
  toggleParent: (id: number) => void;
  lockCategory?: boolean;
  onClear: () => void;
  initialCategory?: number;
}) {
  const isAr = lang === "ar";
  const hasActiveFilters = q || category !== initialCategory || priceRange.min || priceRange.max;

  return (
    <div
      style={{
        background: "var(--ink)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        boxShadow: "0 20px 60px oklch(0.22 0.08 41 / 0.35), 0 4px 12px oklch(0.22 0.08 41 / 0.2)",
        position: "relative",
      }}
    >
      {/* Subtle top-left glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -40,
          insetInlineStart: -40,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle, oklch(0.748 0.106 70 / 0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: "22px 22px 18px",
          borderBottom: "1px solid oklch(1 0 0 / 0.08)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          position: "relative",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 2px",
              fontSize: "9.5px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--warm)",
              fontWeight: 700,
              opacity: 0.8,
            }}
          >
            {isAr ? "كابيلا كيرز" : "Capella Cares"}
          </p>
          <span
            style={{
              fontFamily: isAr ? "var(--font-ar)" : "var(--font-display)",
              fontStyle: isAr ? "normal" : "italic",
              fontWeight: isAr ? 700 : 400,
              fontSize: isAr ? "22px" : "26px",
              color: "var(--canvas)",
              letterSpacing: isAr ? "-0.01em" : "-0.02em",
              lineHeight: 1.05,
              display: "block",
            }}
          >
            {dict.filters.title}
          </span>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 28,
              paddingInline: 11,
              borderRadius: "var(--radius-pill)",
              background: "oklch(1 0 0 / 0.08)",
              border: "1px solid oklch(1 0 0 / 0.15)",
              color: "oklch(0.94 0.06 85 / 0.7)",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.02em",
              cursor: "pointer",
              transition: "background 160ms, color 160ms",
              flexShrink: 0,
              marginBottom: "3px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "oklch(1 0 0 / 0.14)";
              (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.94 0.06 85)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "oklch(1 0 0 / 0.08)";
              (e.currentTarget as HTMLButtonElement).style.color = "oklch(0.94 0.06 85 / 0.7)";
            }}
          >
            <Icon.Close size={9} />
            {dict.common.clear}
          </button>
        )}
      </div>

      {/* Filter body */}
      <div style={{ padding: "0 22px" }}>
        {/* Search */}
        <FilterSection label={dict.nav.search} defaultOpen dark>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "oklch(1 0 0 / 0.06)",
              border: "1px solid oklch(1 0 0 / 0.12)",
              borderRadius: "var(--radius)",
              padding: "9px 14px",
              transition: "border-color 180ms",
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
                fontSize: "13.5px",
                color: "oklch(0.97 0.03 85)",
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
                  flexShrink: 0,
                }}
              >
                <Icon.Close size={9} />
              </button>
            )}
          </div>
        </FilterSection>

        {/* Categories */}
        {!lockCategory && (
          <FilterSection label={dict.filters.category} defaultOpen dark>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                maxHeight: "260px",
                overflowY: "auto",
                paddingInlineEnd: "2px",
                scrollbarWidth: "thin",
                scrollbarColor: "oklch(1 0 0 / 0.1) transparent",
              }}
            >
              <CategoryPill name="cat" checked={!category} onChange={() => setCategory(undefined)}>
                {dict.nav.allCategories}
              </CategoryPill>

              {categoryTree.length > 0
                ? categoryTree.map(({ parent, children }) => {
                    const isOpen =
                      openParents[parent.id] ??
                      Boolean(category && (category === parent.id || children.some((c) => c.id === category)));

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
                                transition: "background 160ms",
                              }}
                            >
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                style={{ transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
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
          </FilterSection>
        )}

        {/* Price range */}
        <FilterSection label={dict.filters.price} defaultOpen={false} dark>
          <div style={{ display: "grid", gap: 8 }}>
            <PriceInput value={priceRange.min} onChange={(v) => setPriceRange((s) => ({ ...s, min: v }))} placeholder={dict.filters.priceMin} lang={lang} dark />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
              <span style={{ fontSize: "10px", color: "oklch(0.94 0.06 85 / 0.35)", letterSpacing: "0.1em", fontWeight: 600 }}>
                {isAr ? "إلى" : "TO"}
              </span>
              <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
            </div>
            <PriceInput value={priceRange.max} onChange={(v) => setPriceRange((s) => ({ ...s, max: v }))} placeholder={dict.filters.priceMax} lang={lang} dark />
          </div>
        </FilterSection>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "14px 22px 18px",
          marginTop: "4px",
          borderTop: "1px solid oklch(1 0 0 / 0.08)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--warm)",
            opacity: 0.6,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "10px", color: "oklch(0.94 0.06 85 / 0.3)", letterSpacing: "0.14em", fontWeight: 600, textTransform: "uppercase" }}>
          {isAr ? "صُنع في مصر" : "Made in Egypt"}
        </span>
      </div>
    </div>
  );
}

/* ─── Mobile drawer overlay ─── */
function MobileFilterDrawer({
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
  onClear,
  initialCategory,
}: {
  open: boolean;
  onClose: () => void;
  lang: Language;
  dict: any;
  q: string;
  setQ: (v: string) => void;
  category: number | undefined;
  setCategory: (v: number | undefined) => void;
  priceRange: { min: string; max: string };
  setPriceRange: React.Dispatch<React.SetStateAction<{ min: string; max: string }>>;
  categoryTree: { parent: Category; children: Category[] }[];
  categories: Category[];
  openParents: Record<number, boolean>;
  toggleParent: (id: number) => void;
  lockCategory?: boolean;
  onClear: () => void;
  initialCategory?: number;
}) {
  const isAr = lang === "ar";

  // Prevent scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "oklch(0.22 0.04 45 / 0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 50,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 280ms cubic-bezier(0.16,1,0.3,1)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          insetBlockStart: 0,
          insetBlockEnd: 0,
          insetInlineStart: 0,
          width: "min(340px, 90vw)",
          background: "var(--ink)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px oklch(0.22 0.08 41 / 0.5)",
          transform: open ? "translateX(0)" : isAr ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 320ms cubic-bezier(0.16,1,0.3,1)",
          overflowY: "auto",
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: "20px 20px 16px",
            borderBottom: "1px solid oklch(1 0 0 / 0.08)",
            background: "var(--ink)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          <div>
            <p style={{ margin: "0 0 1px", fontSize: "9px", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--warm)", fontWeight: 700, opacity: 0.8 }}>
              {isAr ? "كابيلا كيرز" : "Capella Cares"}
            </p>
            <span
              style={{
                fontFamily: isAr ? "var(--font-ar)" : "var(--font-display)",
                fontStyle: isAr ? "normal" : "italic",
                fontWeight: isAr ? 700 : 400,
                fontSize: isAr ? "20px" : "24px",
                color: "var(--canvas)",
                letterSpacing: isAr ? "-0.01em" : "-0.02em",
                lineHeight: 1.05,
                display: "block",
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
              border: "1px solid oklch(1 0 0 / 0.15)",
              background: "oklch(1 0 0 / 0.07)",
              color: "oklch(0.94 0.06 85 / 0.7)",
              cursor: "pointer",
              transition: "background 160ms",
              flexShrink: 0,
              marginBottom: "2px",
            }}
            aria-label={isAr ? "إغلاق" : "Close filters"}
          >
            <Icon.Close size={13} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", background: "var(--ink)" }}>
          {/* Search */}
          <FilterSection label={dict.nav.search} defaultOpen dark>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "oklch(1 0 0 / 0.06)",
                border: "1px solid oklch(1 0 0 / 0.12)",
                borderRadius: "var(--radius)",
                padding: "9px 14px",
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
                  fontSize: "14px",
                  color: "oklch(0.97 0.03 85)",
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
                    flexShrink: 0,
                  }}
                >
                  <Icon.Close size={9} />
                </button>
              )}
            </div>
          </FilterSection>

          {/* Categories */}
          {!lockCategory && (
            <FilterSection label={dict.filters.category} defaultOpen dark>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <CategoryPill name="cat-mobile" checked={!category} onChange={() => setCategory(undefined)}>
                  {dict.nav.allCategories}
                </CategoryPill>

                {categoryTree.length > 0
                  ? categoryTree.map(({ parent, children }) => {
                      const isOpen =
                        openParents[parent.id] ??
                        Boolean(category && (category === parent.id || children.some((c) => c.id === category)));

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
                                  transition: "background 160ms",
                                }}
                              >
                                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                  style={{ transition: "transform 260ms cubic-bezier(0.16,1,0.3,1)", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
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
            </FilterSection>
          )}

          {/* Price */}
          <FilterSection label={dict.filters.price} defaultOpen={false} dark>
            <div style={{ display: "grid", gap: 8 }}>
              <PriceInput value={priceRange.min} onChange={(v) => setPriceRange((s) => ({ ...s, min: v }))} placeholder={dict.filters.priceMin} lang={lang} dark />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
                <span style={{ fontSize: "10px", color: "oklch(0.94 0.06 85 / 0.35)", letterSpacing: "0.1em", fontWeight: 600 }}>
                  {isAr ? "إلى" : "TO"}
                </span>
                <div style={{ flex: 1, height: "1px", background: "oklch(1 0 0 / 0.1)" }} />
              </div>
              <PriceInput value={priceRange.max} onChange={(v) => setPriceRange((s) => ({ ...s, max: v }))} placeholder={dict.filters.priceMax} lang={lang} dark />
            </div>
          </FilterSection>
        </div>

        {/* Sticky footer CTA */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid oklch(1 0 0 / 0.1)",
            display: "flex",
            gap: 10,
            flexShrink: 0,
            position: "sticky",
            bottom: 0,
            background: "var(--ink)",
            zIndex: 2,
          }}
        >
          <button
            onClick={onClear}
            className="btn btn--ghost btn--sm"
            style={{ flex: 1 }}
          >
            {dict.common.clear}
          </button>
          <button
            onClick={onClose}
            className="btn btn--primary btn--sm"
            style={{ flex: 2 }}
          >
            {isAr ? "عرض النتائج" : "Show results"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Main ProductGrid ─── */
export function ProductGrid({
  products,
  categories,
  lang,
  dict,
  initialSearch = "",
  initialCategory,
  lockCategory,
}: Props) {
  const [q, setQ] = useState(initialSearch);
  const [category, setCategory] = useState<number | undefined>(initialCategory);
  const [sort, setSort] = useState<Sort>("newest");
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [showFilters, setShowFilters] = useState(false);

  const isAr = lang === "ar";

  const categoryById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories]
  );

  const categoryTree = useMemo(() => {
    const parents = categories.filter((item) => item.parentId === null);
    if (parents.length === 0) return [];
    return parents.map((parent) => ({
      parent,
      children: categories.filter((item) => item.parentId === parent.id),
    }));
  }, [categories]);

  const [openParents, setOpenParents] = useState<Record<number, boolean>>(() => {
    const selectedId = initialCategory;
    if (!selectedId) return {};
    const directParent = categories.find((item) => item.id === selectedId)?.parentId;
    return directParent ? { [directParent]: true } : { [selectedId]: true };
  });

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const min = Number(priceRange.min) || 0;
    const max = Number(priceRange.max) || Infinity;

    return products
      .filter((product) => {
        if (ql) {
          const name = safeName(product, lang).toLowerCase();
          if (!name.includes(ql)) return false;
        }
        if (category) {
          const sameCategory = product.categoryId === category;
          const descendantMatch = isDescendantOf(product.categoryId, category, categoryById);
          if (!sameCategory && !descendantMatch) return false;
        }
        const minVariant = minVariantPrice(product);
        if (!Number.isFinite(minVariant)) return false;
        if (minVariant < min || minVariant > max) return false;
        return true;
      })
      .sort((a, b) => {
        const ap = minVariantPrice(a);
        const bp = minVariantPrice(b);
        if (sort === "price-asc") return ap - bp;
        if (sort === "price-desc") return bp - ap;
        if (sort === "name") return safeName(a, lang).localeCompare(safeName(b, lang));
        return b.id - a.id;
      });
  }, [products, q, category, sort, priceRange, lang, categoryById]);

  const toggleParent = (parentId: number) => {
    setOpenParents((current) => ({ ...current, [parentId]: !current[parentId] }));
  };

  const handleClear = () => {
    setQ("");
    setCategory(initialCategory);
    setSort("newest");
    setPriceRange({ min: "", max: "" });
  };

  const sharedFilterProps = {
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
    onClear: handleClear,
    initialCategory,
  };

  const hasActiveFilters =
    q || category !== initialCategory || priceRange.min || priceRange.max;

  return (
    <div className="grid gap-9 pb-20 lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:block lg:sticky lg:top-35 lg:self-start">
        <FilterSidebar {...sharedFilterProps} />
      </aside>

      {/* ── Product area ── */}
      <div className="min-w-0">
        {/* Toolbar row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px 16px",
            borderBottom: "1px solid var(--hairline)",
            paddingBottom: "14px",
            marginBottom: "24px",
          }}
        >
          {/* Mobile filter trigger */}
          <button
            className="lg:hidden"
            onClick={() => setShowFilters(true)}
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
              boxShadow: hasActiveFilters ? "var(--shadow-1)" : "none",
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
                  lineHeight: 1,
                }}
              >
                •
              </span>
            )}
          </button>

          {/* Result count */}
          <span
            style={{
              fontSize: "13px",
              color: "var(--ink-3)",
              letterSpacing: "0.01em",
              order: 3,
              flex: "0 0 100%",
            }}
            className="sm:order-0 sm:flex-[0_0_auto]"
          >
            {dict.common.results.replace("{n}", String(filtered.length))}
          </span>

          {/* Sort control */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "var(--ink-3)",
                letterSpacing: "0.04em",
                fontWeight: 500,
              }}
              className="hidden sm:inline"
            >
              {dict.filters.sortBy}
            </span>
            <div style={{ position: "relative" }}>
              <select
                className="select"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                style={{
                  height: 36,
                  paddingBlock: 0,
                  paddingInlineStart: "12px",
                  paddingInlineEnd: "32px",
                  fontSize: "13px",
                  borderRadius: "var(--radius-pill)",
                  appearance: "none",
                  WebkitAppearance: "none",
                  cursor: "pointer",
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
                  color: "var(--ink-3)",
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

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div
            style={{
              maxWidth: "420px",
              margin: "0 auto",
              display: "grid",
              gap: 16,
              background: "var(--surface)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--radius-xl)",
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--warm-soft)",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.Search size={22} className="text-warm" />
            </div>
            <span
              style={{
                fontFamily: isAr ? "var(--font-ar)" : "var(--font-display)",
                fontStyle: isAr ? "normal" : "italic",
                fontWeight: isAr ? 700 : 500,
                fontSize: "24px",
                color: "var(--ink)",
                letterSpacing: isAr ? "-0.01em" : "-0.02em",
              }}
            >
              {dict.common.empty}
            </span>
            <p
              style={{
                fontSize: "13.5px",
                lineHeight: 1.7,
                color: "var(--ink-2)",
                margin: 0,
              }}
            >
              {isAr
                ? "جرّبي تعديل الفلاتر أو ابحثي عن منتج آخر."
                : "Try adjusting your filters or search for something else."}
            </p>
            {hasActiveFilters && (
              <button onClick={handleClear} className="btn btn--ghost btn--sm" style={{ justifySelf: "center" }}>
                {dict.common.clear}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] lg:gap-7">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile drawer ── */}
      <MobileFilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        {...sharedFilterProps}
      />
    </div>
  );
}
