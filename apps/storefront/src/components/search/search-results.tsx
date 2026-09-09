"use client";

import { useState } from "react";
import type { Collection, Language, Offer, Product } from "@capella/shared";
import { ProductCard } from "@/components/products/product-card";
import { SectionCard } from "@/components/shop/section-card";
import { ColumnsToggle, type Cols } from "@/components/ui/columns-toggle";

export function SearchResults({
  products,
  offers,
  collections,
  categoryNames,
  lang,
  dict
}: {
  products: Product[];
  offers: Offer[];
  collections: Collection[];
  categoryNames: Record<string, string>;
  lang: Language;
  dict: any;
}) {
  const [cols, setCols] = useState<Cols>(2);
  const isAr = lang === "ar";

  const gridCols = cols === 1
    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  const heading = (text: string) => (
    <header className="mb-6">
      <h2 className={isAr
        ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
        : "m-0 text-[clamp(24px,2.4vw,36px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
        {text}
      </h2>
    </header>
  );

  return (
    <div className="grid gap-10 pb-8 sm:gap-12">
      <div className="flex justify-end">
        <ColumnsToggle cols={cols} onChange={setCols} lang={lang} />
      </div>

      {offers.length > 0 && (
        <section className="min-w-0">
          {heading(dict.ask.sections.offers)}
          <div
            data-cols={cols}
            className={`grid gap-5 sm:gap-6 lg:gap-7 ${gridCols}`}
          >
            {offers.map((offer) => (
              <SectionCard
                key={offer.id}
                kind="offer"
                data={offer}
                lang={lang}
                dict={dict}
                categoryName={offer.categoryId != null ? categoryNames[String(offer.categoryId)] : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {collections.length > 0 && (
        <section className="min-w-0">
          {heading(dict.ask.sections.collections)}
          <div
            data-cols={cols}
            className={`grid gap-5 sm:gap-6 lg:gap-7 ${gridCols}`}
          >
            {collections.map((collection) => (
              <SectionCard
                key={collection.id}
                kind="collection"
                data={collection}
                lang={lang}
                dict={dict}
                categoryName={categoryNames[String(collection.categoryId)]}
              />
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section className="min-w-0">
          {heading(dict.ask.sections.products)}
          <div
            data-cols={cols}
            className={`group/cards grid gap-4 md:gap-6 lg:gap-7 ${gridCols}`}
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                lang={lang}
                dict={dict}
                categoryName={categoryNames[String(product.categoryId)]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
