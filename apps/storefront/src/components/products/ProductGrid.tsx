"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { ProductCard } from "@/components/homepage/ProductCard";
import type { StorefrontProduct } from "@/lib/products";

/** Titled wrapping grid of product cards used by the catalog listing pages. */
export function ProductGrid({ title, products }: { title: string; products: StorefrontProduct[] }) {
  const { lang, dict } = useLocale();
  return (
    <section aria-label={title} className="py-8">
      <h1 className="mb-6 text-2xl font-extrabold uppercase tracking-[0.15em] text-brand-dark">{title}</h1>
      {products.length === 0 ? (
        <p className="py-12 text-center text-gray-500">{dict.pages.noResults}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
          ))}
        </div>
      )}
    </section>
  );
}
