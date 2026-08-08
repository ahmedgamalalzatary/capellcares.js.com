"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getEffectiveVariantPrice, type Language, type Product } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { fetchProducts } from "@/lib/api/client";
import { matchesProductQuery } from "@/lib/product-search";
import { SEARCH_MAX_RESULTS as MAX_RESULTS } from "@/constants/ui";

type SearchOverlayProps = {
  lang: Language;
  dict: any;
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ lang, dict, open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Lazily load the catalogue once, the first time the overlay opens.
  useEffect(() => {
    if (!open || products) return;
    let cancelled = false;
    fetchProducts({ lang })
      .then((items) => !cancelled && setProducts(items))
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, [open, products, lang]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setTerm("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    if (!term.trim() || !products) return [];
    return products
      .filter((product) => matchesProductQuery(product, term))
      .slice(0, MAX_RESULTS);
  }, [term, products]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = term.trim();
    if (!t) return;
    router.push(`/${lang}/products?q=${encodeURIComponent(t)}`);
    onClose();
  };

  return (
    <div
      className={[
        "fixed inset-0 z-100 transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      ].join(" ")}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={dict.nav.search}
        className={[
          "absolute inset-x-0 top-0 mx-auto w-full max-w-2xl px-4 pt-6 transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "-translate-y-4"
        ].join(" ")}
      >
        <div className="overflow-hidden rounded-2xl border border-black bg-canvas shadow-(--shadow-2)">
          <form onSubmit={submit} className="flex items-center gap-3 border-b border-black px-5 py-4">
            <Icon.Search />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={dict.nav.search}
              aria-label={dict.nav.search}
              className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-(--ink-3)"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={dict.common.back}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-(--ink-3) hover:bg-(--warm-soft) hover:text-ink"
            >
              <Icon.Close />
            </button>
          </form>

          {term.trim() && (
            <div className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-(--ink-3)">
                  {products === null ? dict.common.loading : dict.search?.empty ?? dict.common.empty}
                </p>
              ) : (
                <ul>
                  {results.map((p) => {
                    const prices = p.variants.map((v) => getEffectiveVariantPrice(v));
                    const min = prices.length ? Math.min(...prices) : 0;
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/${lang}/products/${p.slug}`}
                          onClick={onClose}
                          className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-(--warm-soft)"
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-(--hairline) bg-surface">
                            <ProductIllustration product={p} className="h-full w-full object-contain" />
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                            {pickLang(p.name, lang)}
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-accent">
                            {formatPrice(min, lang)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  <li>
                    <button
                      type="button"
                      onClick={submit}
                      className="w-full px-5 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-(--warm-soft)"
                    >
                      {dict.nav.viewAll}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
