"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getEffectiveVariantPrice, type Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { buildCategoryHref } from "@/lib/category-links";
import { searchStorefront, type StorefrontSearchResults } from "@/lib/storefront-search";

type SearchOverlayProps = {
  lang: Language;
  dict: any;
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ lang, dict, open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StorefrontSearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const query = term.trim();
    if (!open || !query) {
      requestIdRef.current += 1;
      setResults(null);
      setSearching(false);
      setSearchFailed(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setSearching(true);
    setSearchFailed(false);
    const timer = window.setTimeout(() => {
      void searchStorefront(query, lang)
        .then((nextResults) => {
          if (requestId === requestIdRef.current) setResults(nextResults);
        })
        .catch(() => {
          if (requestId === requestIdRef.current) {
            setResults(null);
            setSearchFailed(true);
          }
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setSearching(false);
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      if (requestId === requestIdRef.current) requestIdRef.current += 1;
    };
  }, [lang, open, term]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setTerm("");
    }
  }, [open]);

  // While the overlay is up, the page behind must not scroll — wheel and touch
  // scrolling belong to the results list, which has its own overflow container.
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
            <div className="max-h-[70vh] overflow-y-auto">
              {searching ? (
                <p className="px-5 py-8 text-center text-sm text-(--ink-3)">
                  {dict.common.loading}
                </p>
              ) : searchFailed ? (
                <p className="px-5 py-8 text-center text-sm text-(--ink-3)">{dict.auth.genericError}</p>
              ) : results && Object.values(results).every((items) => items.length === 0) ? (
                <p className="px-5 py-8 text-center text-sm text-(--ink-3)">
                  {dict.ask.empty.replace("{q}", term.trim())}
                </p>
              ) : results ? (
                <div className="flex flex-col gap-4 px-5 py-4">
                  {results.products.length > 0 && (
                    <section>
                      <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">
                        {dict.ask.sections.products}
                      </h2>
                      <ul>
                        {results.products.map((product) => {
                          const prices = product.variants.map((variant) => getEffectiveVariantPrice(variant));
                          const minPrice = prices.length ? Math.min(...prices) : 0;
                          return (
                            <li key={product.id}>
                              <Link
                                href={`/${lang}/products/${product.slug}`}
                                onClick={onClose}
                                className="flex items-center gap-4 rounded-(--radius) py-2 transition-colors hover:bg-(--warm-soft)"
                              >
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-(--hairline) bg-surface">
                                  <ProductIllustration product={product} className="h-full w-full object-contain" />
                                </div>
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                                  {pickLang(product.name, lang)}
                                </span>
                                <span className="shrink-0 text-sm font-semibold text-accent">
                                  {formatPrice(minPrice, lang)}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}

                  {results.categories.length > 0 && (
                    <section>
                      <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">
                        {dict.ask.sections.categories}
                      </h2>
                      <div className="flex flex-wrap gap-1.5">
                        {results.categories.map((category) => (
                          <Link
                            key={category.id}
                            href={buildCategoryHref(lang, category)}
                            onClick={onClose}
                            className="rounded-(--radius-pill) border border-(--hairline) bg-canvas px-3 py-1.5 text-xs text-(--ink-2) transition-colors hover:border-warm hover:bg-(--warm-soft)"
                          >
                            {pickLang(category.name, lang)}
                          </Link>
                        ))}
                      </div>
                    </section>
                  )}

                  {results.offers.length > 0 && (
                    <section>
                      <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">
                        {dict.ask.sections.offers}
                      </h2>
                      {results.offers.map((offer) => (
                        <Link
                          key={offer.id}
                          href={`/${lang}/offers/${offer.slug}`}
                          onClick={onClose}
                          className="flex items-center justify-between gap-2 rounded-(--radius) py-2 transition-colors hover:bg-(--warm-soft)"
                        >
                          <span className="truncate text-sm text-ink">{pickLang(offer.name, lang)}</span>
                          {offer.originalTotal > offer.price && (
                            <span className="chip chip--accent shrink-0 text-xs">
                              {dict.offers.save.replace("{amount}", formatPrice(offer.originalTotal - offer.price, lang))}
                            </span>
                          )}
                        </Link>
                      ))}
                    </section>
                  )}

                  {results.collections.length > 0 && (
                    <section>
                      <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">
                        {dict.ask.sections.collections}
                      </h2>
                      {results.collections.map((collection) => (
                        <Link
                          key={collection.id}
                          href={`/${lang}/collections/${collection.slug}`}
                          onClick={onClose}
                          className="flex items-center justify-between gap-2 rounded-(--radius) py-2 transition-colors hover:bg-(--warm-soft)"
                        >
                          <span className="truncate text-sm text-ink">{pickLang(collection.name, lang)}</span>
                          {collection.originalTotal > collection.price && (
                            <span className="chip chip--accent shrink-0 text-xs">
                              {dict.offers.save.replace(
                                "{amount}",
                                formatPrice(collection.originalTotal - collection.price, lang)
                              )}
                            </span>
                          )}
                        </Link>
                      ))}
                    </section>
                  )}

                  <button
                    type="button"
                    onClick={submit}
                    className="w-full border-t border-(--hairline) pt-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-ink"
                  >
                    {dict.nav.viewAll}
                  </button>
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-(--ink-3)">{dict.common.loading}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
