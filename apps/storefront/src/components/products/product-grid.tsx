"use client";

import { useMemo, useState } from "react";
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

export function ProductGrid({ products, categories, lang, dict, initialSearch = "", initialCategory, lockCategory }: Props) {
  const [q, setQ] = useState(initialSearch);
  const [category, setCategory] = useState<number | undefined>(initialCategory);
  const [sort, setSort] = useState<Sort>("newest");
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [showFilters, setShowFilters] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories]);

  const categoryTree = useMemo(() => {
    const parents = categories.filter((item) => item.parentId === null);
    if (parents.length === 0) return [];

    return parents.map((parent) => ({
      parent,
      children: categories.filter((item) => item.parentId === parent.id)
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

  return (
    <div className="grid gap-9 pb-20 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden min-w-0 overflow-hidden rounded-[18px] border border-(--hairline) bg-(--bg-elev) p-5 shadow-(--shadow-1) lg:sticky lg:top-[120px] lg:grid lg:gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[20px] font-(--font-display)">{dict.filters.title}</span>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setQ("");
              setCategory(initialCategory);
              setSort("newest");
              setPriceRange({ min: "", max: "" });
            }}
          >
            {dict.common.clear}
          </button>
        </div>

        <div className="grid gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
            {dict.nav.search}
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-[12px] border border-(--hairline) bg-white px-3.5 py-2.5 focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(161,59,75,0.08)]">
            <Icon.Search size={16} className="text-(--ink-3)" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={dict.nav.search}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-(--ink-3)"
            />
          </div>
        </div>

        {!lockCategory && (
          <div className="grid gap-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
              {dict.filters.category}
            </div>
            <div className="grid max-h-[300px] gap-1 overflow-y-auto pr-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-(--bg-tint)">
                <input className="h-4 w-4 accent-accent" type="radio" name="cat" checked={!category} onChange={() => setCategory(undefined)} />
                <span>{dict.nav.allCategories}</span>
              </label>

              {categoryTree.length > 0
                ? categoryTree.map(({ parent, children }) => {
                    const isOpen =
                      openParents[parent.id] ??
                      Boolean(category && (category === parent.id || children.some((child) => child.id === category)));

                    return (
                      <div key={parent.id} className="grid gap-1">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-(--bg-tint)">
                            <input className="h-4 w-4 accent-accent" type="radio" name="cat" checked={category === parent.id} onChange={() => setCategory(parent.id)} />
                            <span>{pickLang(parent.name, lang)}</span>
                          </label>
                          {children.length > 0 && (
                            <button
                              type="button"
                              className="grid h-7 w-7 place-items-center rounded-full border-0 bg-transparent text-(--ink-2) hover:bg-(--bg-tint)"
                              aria-label={lang === "ar" ? "تبديل الفئة" : "Toggle category"}
                              aria-expanded={isOpen}
                              onClick={() => toggleParent(parent.id)}
                            >
                              <Icon.Chevron size={14} className={isOpen ? "rotate-180" : undefined} />
                            </button>
                          )}
                        </div>
                        {children.length > 0 && isOpen && (
                          <div className="grid gap-0.5 pl-5">
                            {children.map((child) => (
                              <label key={child.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-(--ink-2) transition-colors hover:bg-(--bg-tint)">
                                <input className="h-4 w-4 accent-accent" type="radio" name="cat" checked={category === child.id} onChange={() => setCategory(child.id)} />
                                <span>{pickLang(child.name, lang)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                : categories.slice(0, 14).map((item) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-(--bg-tint)">
                      <input className="h-4 w-4 accent-accent" type="radio" name="cat" checked={category === item.id} onChange={() => setCategory(item.id)} />
                      <span>{pickLang(item.name, lang)}</span>
                    </label>
                  ))}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
            {dict.filters.price}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <input
              className="input"
              type="number"
              min="0"
              placeholder={dict.filters.priceMin}
              value={priceRange.min}
              onChange={(e) => setPriceRange((state) => ({ ...state, min: e.target.value }))}
            />
            <span className="text-(--ink-3)">—</span>
            <input
              className="input"
              type="number"
              min="0"
              placeholder={dict.filters.priceMax}
              value={priceRange.max}
              onChange={(e) => setPriceRange((state) => ({ ...state, max: e.target.value }))}
            />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-(--hairline) pb-3">
          <button className="btn btn--ghost btn--sm lg:hidden" onClick={() => setShowFilters((state) => !state)}>
            {dict.common.filters}
          </button>
          <span className="text-sm text-(--ink-2)">
            {dict.common.results.replace("{n}", String(filtered.length))}
          </span>
          <div className="inline-flex items-center gap-2">
            <span className="text-sm text-(--ink-2)">{dict.filters.sortBy}</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">{dict.filters.sortNewest}</option>
              <option value="price-asc">{dict.filters.sortPriceAsc}</option>
              <option value="price-desc">{dict.filters.sortPriceDesc}</option>
              <option value="name">{dict.filters.sortName}</option>
            </select>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 grid gap-5 rounded-[18px] border border-(--hairline) bg-(--bg-elev) p-5 shadow-(--shadow-1) lg:hidden">
            <div className="flex items-center justify-between">
              <span className="text-[20px] font-(--font-display)">{dict.filters.title}</span>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setQ("");
                  setCategory(initialCategory);
                  setSort("newest");
                  setPriceRange({ min: "", max: "" });
                }}
              >
                {dict.common.clear}
              </button>
            </div>

            <div className="grid gap-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
                {dict.nav.search}
              </div>
              <div className="flex min-w-0 items-center gap-2 rounded-[12px] border border-(--hairline) bg-white px-3.5 py-2.5 focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(161,59,75,0.08)]">
                <Icon.Search size={16} className="text-(--ink-3)" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={dict.nav.search}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-(--ink-3)"
                />
              </div>
            </div>

            {!lockCategory && (
              <div className="grid gap-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
                  {dict.filters.category}
                </div>
                <div className="grid gap-1">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-(--bg-tint)">
                    <input className="h-4 w-4 accent-accent" type="radio" name="cat-mobile" checked={!category} onChange={() => setCategory(undefined)} />
                    <span>{dict.nav.allCategories}</span>
                  </label>
                  {categoryTree.map(({ parent, children }) => {
                    const isOpen =
                      openParents[parent.id] ??
                      Boolean(category && (category === parent.id || children.some((child) => child.id === category)));

                    return (
                      <div key={parent.id} className="grid gap-1">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-(--bg-tint)">
                            <input className="h-4 w-4 accent-accent" type="radio" name="cat-mobile" checked={category === parent.id} onChange={() => setCategory(parent.id)} />
                            <span>{pickLang(parent.name, lang)}</span>
                          </label>
                          {children.length > 0 && (
                            <button
                              type="button"
                              className="grid h-7 w-7 place-items-center rounded-full border-0 bg-transparent text-(--ink-2) hover:bg-(--bg-tint)"
                              aria-label={lang === "ar" ? "تبديل الفئة" : "Toggle category"}
                              aria-expanded={isOpen}
                              onClick={() => toggleParent(parent.id)}
                            >
                              <Icon.Chevron size={14} className={isOpen ? "rotate-180" : undefined} />
                            </button>
                          )}
                        </div>
                        {children.length > 0 && isOpen && (
                          <div className="grid gap-0.5 pl-5">
                            {children.map((child) => (
                              <label key={child.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-(--ink-2) transition-colors hover:bg-(--bg-tint)">
                                <input className="h-4 w-4 accent-accent" type="radio" name="cat-mobile" checked={category === child.id} onChange={() => setCategory(child.id)} />
                                <span>{pickLang(child.name, lang)}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-(--ink-3)">
                {dict.filters.price}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder={dict.filters.priceMin}
                  value={priceRange.min}
                  onChange={(e) => setPriceRange((state) => ({ ...state, min: e.target.value }))}
                />
                <span className="text-(--ink-3)">—</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder={dict.filters.priceMax}
                  value={priceRange.max}
                  onChange={(e) => setPriceRange((state) => ({ ...state, max: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="grid gap-2 py-20 text-center">
            <span className="text-[22px] font-(--font-display)">{dict.common.empty}</span>
            <p className="text-(--ink-2)">{lang === "ar" ? "جربي تغيير الفلاتر." : "Try adjusting your filters."}</p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

