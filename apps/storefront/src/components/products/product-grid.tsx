"use client";

import { useMemo, useState } from "react";
import { pickLang, type Language, type Product, type Category } from "@capella/shared";
import { ProductCard } from "./product-card";
import styles from "./product-grid.module.css";
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
  return Math.min(...variants.map((v) => Number(v?.price ?? Number.POSITIVE_INFINITY)));
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
      .filter((p) => {
        if (ql) {
          const name = safeName(p, lang).toLowerCase();
          if (!name.includes(ql)) return false;
        }
        if (category) {
          const sameCategory = p.categoryId === category;
          const descendantMatch = isDescendantOf(p.categoryId, category, categoryById);
          if (!sameCategory && !descendantMatch) return false;
        }
        const minVariant = minVariantPrice(p);
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
    <div className={styles.wrap}>
      <aside className={`${styles.filters} ${showFilters ? styles.filtersOpen : ""}`}>
        <div className={styles.filterHead}>
          <span className="display" style={{ fontSize: 20 }}>{dict.filters.title}</span>
          <button className="btn btn--ghost btn--sm" onClick={() => { setQ(""); setCategory(initialCategory); setSort("newest"); setPriceRange({ min: "", max: "" }); }}>
            {dict.common.clear}
          </button>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterLabel}>{dict.nav.search}</div>
          <div className={styles.searchInner}>
            <Icon.Search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={dict.nav.search}
              className={styles.search}
            />
          </div>
        </div>

        {!lockCategory && (
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>{dict.filters.category}</div>
            <div className={styles.catList}>
              <label className={styles.catItem}>
                <input type="radio" name="cat" checked={!category} onChange={() => setCategory(undefined)} />
                <span>{dict.nav.allCategories}</span>
              </label>
              {categoryTree.length > 0 ? categoryTree.map(({ parent, children }) => {
                const isOpen = openParents[parent.id] ?? Boolean(category && (category === parent.id || children.some((child) => child.id === category)));
                return (
                  <div key={parent.id} className={styles.catGroup}>
                    <div className={styles.catRow}>
                      <label className={styles.catItem}>
                        <input type="radio" name="cat" checked={category === parent.id} onChange={() => setCategory(parent.id)} />
                        <span>{pickLang(parent.name, lang)}</span>
                      </label>
                      {children.length > 0 && (
                        <button
                          type="button"
                          className={styles.catToggle}
                          aria-label={lang === "ar" ? "تبديل الفئة" : "Toggle category"}
                          aria-expanded={isOpen}
                          onClick={() => toggleParent(parent.id)}
                        >
                          <Icon.Chevron size={14} className={isOpen ? styles.chevronOpen : undefined} />
                        </button>
                      )}
                    </div>
                    {children.length > 0 && isOpen && (
                      <div className={styles.catChildren}>
                        {children.map((child) => (
                          <label key={child.id} className={`${styles.catItem} ${styles.catChild}`}>
                            <input type="radio" name="cat" checked={category === child.id} onChange={() => setCategory(child.id)} />
                            <span>{pickLang(child.name, lang)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : categories.slice(0, 14).map((c) => (
                <label key={c.id} className={styles.catItem}>
                  <input type="radio" name="cat" checked={category === c.id} onChange={() => setCategory(c.id)} />
                  <span>{pickLang(c.name, lang)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={styles.filterGroup}>
          <div className={styles.filterLabel}>{dict.filters.price}</div>
          <div className={styles.priceRow}>
            <input
              className="input"
              type="number" min="0" placeholder={dict.filters.priceMin}
              value={priceRange.min}
              onChange={(e) => setPriceRange((s) => ({ ...s, min: e.target.value }))}
            />
            <span style={{ color: "var(--ink-3)" }}>—</span>
            <input
              className="input"
              type="number" min="0" placeholder={dict.filters.priceMax}
              value={priceRange.max}
              onChange={(e) => setPriceRange((s) => ({ ...s, max: e.target.value }))}
            />
          </div>
        </div>
      </aside>

      <div>
        <div className={styles.toolbar}>
          <button className="btn btn--ghost btn--sm" onClick={() => setShowFilters((s) => !s)}>
            {dict.common.filters}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>{dict.common.results.replace("{n}", String(filtered.length))}</span>
          <div className={styles.sortWrap}>
            <span className="muted" style={{ fontSize: 13 }}>{dict.filters.sortBy}</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">{dict.filters.sortNewest}</option>
              <option value="price-asc">{dict.filters.sortPriceAsc}</option>
              <option value="price-desc">{dict.filters.sortPriceDesc}</option>
              <option value="name">{dict.filters.sortName}</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className="display" style={{ fontSize: 22 }}>{dict.common.empty}</span>
            <p className="muted">{lang === "ar" ? "جربي تغيير الفلاتر." : "Try adjusting your filters."}</p>
          </div>
        ) : (
          <div className="grid grid--products">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} lang={lang} dict={dict} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
