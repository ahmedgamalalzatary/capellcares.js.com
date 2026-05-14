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

export function ProductGrid({ products, categories, lang, dict, initialSearch = "", initialCategory, lockCategory }: Props) {
  const [q, setQ] = useState(initialSearch);
  const [category, setCategory] = useState<number | undefined>(initialCategory);
  const [sort, setSort] = useState<Sort>("newest");
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: "", max: "" });
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const min = Number(priceRange.min) || 0;
    const max = Number(priceRange.max) || Infinity;

    return products
      .filter((p) => {
        if (ql) {
          const name = pickLang(p.name, lang).toLowerCase();
          if (!name.includes(ql)) return false;
        }
        if (category && p.categoryId !== category) {
          // simple match — for trees we'd descend; left as-is for grid use cases
          return false;
        }
        const minVariant = Math.min(...p.variants.map((v) => v.price));
        if (minVariant < min || minVariant > max) return false;
        return true;
      })
      .sort((a, b) => {
        const ap = Math.min(...a.variants.map((v) => v.price));
        const bp = Math.min(...b.variants.map((v) => v.price));
        if (sort === "price-asc") return ap - bp;
        if (sort === "price-desc") return bp - ap;
        if (sort === "name") return pickLang(a.name, lang).localeCompare(pickLang(b.name, lang));
        return b.id - a.id;
      });
  }, [products, q, category, sort, priceRange, lang]);

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
              {categories.slice(0, 14).map((c) => (
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
