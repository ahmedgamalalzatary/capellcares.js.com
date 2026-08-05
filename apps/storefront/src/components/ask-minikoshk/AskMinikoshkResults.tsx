"use client";

import type { Dict, Language } from "@minikoshk/shared";
import { formatPrice } from "@/lib/format";
import { productPrice } from "@/lib/products";
import type { AskMinikoshkResults as SearchResults } from "@/types/ask-minikoshk.types";

export function AskMinikoshkResults({
  results,
  query,
  lang,
  dict,
  error = false,
  onClose
}: {
  results: SearchResults;
  query: string;
  lang: Language;
  dict: Dict;
  error?: boolean;
  onClose: () => void;
}) {
  if (error) {
    return <p className="text-sm leading-6 text-gray-600">{dict.ask.error}</p>;
  }
  const hasResults = Object.values(results).some((items) => items.length > 0);
  if (!hasResults) {
    return (
      <div className="text-sm leading-6 text-gray-600">
        <p>{dict.ask.noResults.replace("{query}", query)}</p>
        <a href={`/${lang}/products`} onClick={onClose} className="mt-1.5 inline-block font-semibold text-brand-red hover:underline">
          {dict.ask.browseAll}
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="leading-6 text-gray-600">{dict.ask.found}</p>
      {results.products.length > 0 && (
        <ResultSection title={dict.ask.sections.products}>
          {results.products.map((product) => (
            <a key={product.id} href={`/${lang}/products/${product.slug}`} onClick={onClose} className="flex items-center gap-2.5 rounded-lg p-1.5 transition hover:bg-gray-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {product.imagePath && <img src={product.imagePath} alt="" className="h-full w-full object-contain p-1" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-brand-dark">{product.name[lang]}</span>
                <span className="block text-xs text-gray-500">{formatPrice(productPrice(product), lang, dict.product.currency)}</span>
              </span>
            </a>
          ))}
        </ResultSection>
      )}
      {results.categories.length > 0 && (
        <ResultSection title={dict.ask.sections.categories}>
          <div className="flex flex-wrap gap-1.5">
            {results.categories.map((category) => (
              <a key={category.id} href={`/${lang}/shop?category=${encodeURIComponent(category.slug)}`} onClick={onClose} className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-brand-dark transition hover:border-brand-red hover:text-brand-red">
                {category.name[lang]}
              </a>
            ))}
          </div>
        </ResultSection>
      )}
      {results.offers.length > 0 && (
        <ResultSection title={dict.ask.sections.offers}>
          {results.offers.map((offer) => <BundleResult key={offer.id} bundle={offer} href={`/${lang}/offers/${offer.slug}`} lang={lang} dict={dict} onClose={onClose} />)}
        </ResultSection>
      )}
      {results.collections.length > 0 && (
        <ResultSection title={dict.ask.sections.collections}>
          {results.collections.map((collection) => <BundleResult key={collection.id} bundle={collection} href={`/${lang}/collections/${collection.slug}`} lang={lang} dict={dict} onClose={onClose} />)}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function BundleResult({ bundle, href, lang, dict, onClose }: {
  bundle: SearchResults["offers"][number];
  href: string;
  lang: Language;
  dict: Dict;
  onClose: () => void;
}) {
  const savings = Math.max(0, bundle.originalTotal - bundle.price);
  return (
    <a href={href} onClick={onClose} className="flex items-center justify-between gap-2 rounded-lg p-1.5 transition hover:bg-gray-50">
      <span className="truncate text-brand-dark">{bundle.name[lang]}</span>
      {savings > 0 && <span className="shrink-0 rounded-md bg-brand-dark px-2 py-1 text-xs font-semibold text-white">{dict.ask.save} {formatPrice(savings, lang, dict.product.currency)}</span>}
    </a>
  );
}
