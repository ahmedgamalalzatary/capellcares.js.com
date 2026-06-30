"use client";

import Link from "next/link";
import { formatPrice, getDict, getEffectiveVariantPrice, pickLang, type Language } from "@capella/shared";
import { buildCategoryHref } from "@/lib/category-links";
import type { AskCapellaResults } from "../../types/ask-capella.types";

export function AskCapellaReplyContent({
  results,
  query,
  lang,
  dict,
  error = false,
  errorMessage,
  onClose
}: {
  results: AskCapellaResults;
  query: string;
  lang: Language;
  dict: ReturnType<typeof getDict>;
  error?: boolean;
  errorMessage?: string;
  onClose: () => void;
}) {
  if (error) {
    return (
      <div className="text-sm leading-[1.65]">
        <p className="text-(--ink-2)">{errorMessage ?? dict.ask.noResults.replace("{query}", query)}</p>
      </div>
    );
  }

  const hasResults =
    results.products.length > 0 ||
    results.categories.length > 0 ||
    results.offers.length > 0 ||
    results.collections.length > 0;

  if (!hasResults) {
    return (
      <div className="text-sm leading-[1.65]">
        <p className="text-(--ink-2)">
          {dict.ask.noResults.replace("{query}", query)}
        </p>
        <Link
          href={`/${lang}/products`}
          onClick={onClose}
          className="mt-2 inline-block font-(--font-display) text-sm text-accent underline-offset-4 hover:underline"
        >
          {dict.ask.browseAll}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-(--ink-2) leading-[1.6]">
        {dict.ask.found}
      </p>

      {results.products.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">{dict.ask.sections.products}</p>
          {results.products.map((product) => (
            <Link
              key={product.id}
              href={`/${lang}/products/${product.slug}`}
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-(--radius) p-1.5 transition-colors hover:bg-(--warm-soft)"
            >
              <div className="h-9 w-9 shrink-0 rounded-(--radius) border border-(--hairline) bg-[radial-gradient(circle,var(--warm-soft),var(--surface))]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{pickLang(product.name, lang)}</p>
                {product.variants?.[0] != null && (
                  <p className="text-xs text-(--ink-3)">{formatPrice(getEffectiveVariantPrice(product.variants[0]), lang)}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {results.categories.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">{dict.ask.sections.categories}</p>
          <div className="flex flex-wrap gap-1.5">
            {results.categories.map((category) => (
              <Link
                key={category.id}
                href={buildCategoryHref(lang, category)}
                onClick={onClose}
                className="rounded-(--radius-pill) border border-(--hairline) bg-canvas px-3 py-1 text-xs text-(--ink-2) transition-colors hover:border-warm hover:bg-(--warm-soft)"
              >
                {pickLang(category.name, lang)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {results.offers.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">{dict.ask.sections.offers}</p>
          {results.offers.map((offer) => {
            const savings = offer.originalTotal - offer.price;
            return (
              <Link
                key={offer.id}
                href={`/${lang}/offers/${offer.slug}`}
                onClick={onClose}
                className="flex items-center justify-between gap-2 rounded-(--radius) p-1.5 transition-colors hover:bg-(--warm-soft)"
              >
                <span className="truncate text-ink">{pickLang(offer.name, lang)}</span>
                {savings > 0 && (
                  <span className="chip chip--accent shrink-0 text-xs">
                    {dict.offers.save.replace("{amount}", formatPrice(savings, lang))}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {results.collections.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--ink-3)">{dict.ask.sections.collections}</p>
          {results.collections.map((collection) => {
            const savings = collection.originalTotal - collection.price;
            return (
              <Link
                key={collection.id}
                href={`/${lang}/collections/${collection.slug}`}
                onClick={onClose}
                className="flex items-center justify-between gap-2 rounded-(--radius) p-1.5 transition-colors hover:bg-(--warm-soft)"
              >
                <span className="truncate text-ink">{pickLang(collection.name, lang)}</span>
                {savings > 0 && (
                  <span className="chip chip--accent shrink-0 text-xs">
                    {dict.offers.save.replace("{amount}", formatPrice(savings, lang))}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
