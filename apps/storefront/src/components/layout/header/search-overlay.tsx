"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pickLang, formatPrice, getEffectiveVariantPrice, type Language, type Product } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { ProductCard } from "@/components/products/product-card";
import { NavArrow } from "@/components/ui/nav-arrow";
import { NoCardImageSwipe } from "@/components/ui/card-image-carousel";
import { buildCategoryHref } from "@/lib/category-links";
import { searchStorefront, type StorefrontSearchResults } from "@/lib/storefront-search";

type SearchOverlayProps = {
  lang: Language;
  dict: any;
  open: boolean;
  onClose: () => void;
  /** Best sellers, most important first: the first 6 names become "Popular Searches" and the first 10 fill "Our Most Popular". */
  bestsellers?: Product[];
  /** Main categories, already in menu order. */
  categories?: { key: string; label: string; href: string }[];
};

const CHIP = "shrink-0 whitespace-nowrap rounded-(--radius-pill) border border-(--hairline) bg-canvas px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-warm hover:bg-(--warm-soft)";

/** Phones: one line of chips that slides sideways, so long lists don't push the cards off screen. From sm up they wrap as before. */
const CHIP_LINE = "-mx-5 flex gap-2 overflow-x-auto px-5 scroll-px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0";

export function SearchOverlay({ lang, dict, open, onClose, bestsellers = [], categories = [] }: SearchOverlayProps) {
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

  // While the overlay is up the page behind must not scroll — wheel/touch scrolling belong to the results list, which has its own overflow container.
  // Lock <html>, not <body>: the document element is the scrolling element and body-only `overflow: hidden` is ignored on mobile; same non-shifting lock the mobile drawer uses.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    // Restore whatever was there before instead of blanking it, so an outer lock (a drawer, a modal) that is still up survives this overlay closing.
    const previousOverflow = html.style.overflow;
    const previousPaddingRight = html.style.paddingRight;
    const previousBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) html.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousOverflow;
      html.style.paddingRight = previousPaddingRight;
      document.body.style.overflow = previousBodyOverflow;
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
    // The global results page, not /products: this dropdown previews offers and collections too, so the page behind it has to be able to show them.
    router.push(`/${lang}/search?q=${encodeURIComponent(t)}`);
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
          "absolute inset-x-0 top-0 mx-auto flex max-h-[100dvh] w-full max-w-2xl flex-col px-4 pb-6 pt-6 transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "-translate-y-4"
        ].join(" ")}
      >
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black bg-canvas shadow-(--shadow-2)">
          <form onSubmit={submit} className="flex shrink-0 items-center gap-3 border-b border-black px-5 py-4">
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

          {/* Before anything is typed: quick ways in — best-seller names, main categories, then best-seller cards. */}
          {!term.trim() && (bestsellers.length > 0 || categories.length > 0) && (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-4">
              {bestsellers.length > 0 && (
                <section aria-labelledby="search-popular-words">
                  <h2 id="search-popular-words" className="mb-2 text-base font-bold text-ink">{dict.nav.popularSearches}</h2>
                  <div className={CHIP_LINE}>
                    {bestsellers.slice(0, 6).map((product) => (
                      <Link key={product.id} href={`/${lang}/products/${product.slug}`} onClick={onClose} className={CHIP}>
                        {pickLang(product.name, lang)}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {categories.length > 0 && (
                <section aria-labelledby="search-main-categories">
                  <h2 id="search-main-categories" className="mb-2 text-base font-bold text-ink">{dict.ask.sections.categories}</h2>
                  <div className={CHIP_LINE}>
                    {categories.map((category) => (
                      <Link key={category.key} href={category.href} onClick={onClose} className={CHIP}>
                        {category.label}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {bestsellers.length > 0 && (
                <section aria-labelledby="search-most-popular">
                  <h2 id="search-most-popular" className="mb-2 text-base font-bold text-ink">{dict.nav.mostPopular}</h2>
                  <PopularCardRow lang={lang} dict={dict} products={bestsellers.slice(0, 10)} onClose={onClose} />
                </section>
              )}
            </div>
          )}

          {/* overscroll-contain: a scroll reaching this list's end must not chain to the page. */}
          {term.trim() && (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                                  <ProductIllustration product={product} lang={lang} className="h-full w-full object-contain" />
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

                  {/* Sticky so it stays reachable without scrolling the whole list first. */}
                  <button
                    type="button"
                    onClick={submit}
                    className="sticky bottom-0 -mx-5 -mb-4 w-[calc(100%+2.5rem)] border-t border-(--hairline) bg-canvas px-5 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-ink"
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

/** "Our Most Popular": a sideways row of cards. Phones swipe it; desktop gets previous/next arrows that hide at the row's ends. */
function PopularCardRow({ lang, dict, products, onClose }: { lang: Language; dict: any; products: Product[]; onClose: () => void }) {
  const isRtl = lang === "ar";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // RTL scrollLeft is negative in modern browsers; abs() covers both directions.
    const offset = Math.abs(el.scrollLeft);
    setCanPrev(offset > 1);
    setCanNext(offset < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  const scrollByPage = (direction: "prev" | "next") => {
    const el = scrollerRef.current;
    if (!el) return;
    const sign = (direction === "next" ? 1 : -1) * (isRtl ? -1 : 1);
    el.scrollBy({ left: el.clientWidth * 0.8 * sign, behavior: "smooth" });
  };

  return (
    // The row scrolls sideways, so a sideways swipe must move the row, not flip a card's pictures.
    <NoCardImageSwipe>
      <div className="relative">
        {/* scroll-px-5 matches px-5: snapping lines the first card up with the padding instead of scrolling it to the row's edge. A click on a card leaves the page, so close first. */}
        <div
          ref={scrollerRef}
          data-testid="search-popular-row"
          className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 scroll-px-5 pb-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("a")) onClose();
          }}
        >
          {products.map((product) => (
            <div key={product.id} className="w-40 shrink-0 snap-start sm:w-44">
              <ProductCard product={product} lang={lang} dict={dict} />
            </div>
          ))}
        </div>
        <NavArrow
          direction="prev"
          isRtl={isRtl}
          aria-label={dict.common.previous}
          onClick={() => scrollByPage("prev")}
          disabled={!canPrev}
          className="absolute top-[30%] inset-s-0 z-30 -translate-y-1/2"
        />
        <NavArrow
          direction="next"
          isRtl={isRtl}
          aria-label={dict.common.next}
          onClick={() => scrollByPage("next")}
          disabled={!canNext}
          className="absolute top-[30%] inset-e-0 z-30 -translate-y-1/2"
        />
      </div>
    </NoCardImageSwipe>
  );
}
