"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice, pickLang, type Language, type RelatedItemCard } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { ColumnsToggle, type Cols } from "@/components/ui/columns-toggle";

interface Props {
  items: RelatedItemCard[];
  lang: Language;
  title?: string;
}

function hrefFor(item: RelatedItemCard, lang: Language): string {
  const segment = item.type === "offer" ? "offers" : item.type === "collection" ? "collections" : "products";
  return `/${lang}/${segment}/${item.slug}`;
}

export function RelatedItems({ items, lang, title }: Props) {
  const [cols, setCols] = useState<Cols>(2);

  if (items.length === 0) {
    return null;
  }

  const isAr = lang === "ar";
  // Mirror the category page grid: cols toggle sets the mobile base, then the
  // layout steps up on md/lg the same way (1→3 and 2→4 on desktop).
  const gridCols = cols === 1
    ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <section className="grid gap-4 border-t border-(--hairline) py-4 sm:py-4" data-testid="related-items">
      <div className="flex items-center justify-between gap-4">
        {title ? (
          <h2 className={isAr
            ? "m-0 text-[clamp(20px,2.4vw,28px)] font-bold font-(family-name:--font-ar) text-ink"
            : "m-0 text-[clamp(22px,2.4vw,30px)] font-(--font-display) text-ink"}>
            {title}
          </h2>
        ) : <span />}

        <ColumnsToggle cols={cols} onChange={setCols} lang={lang} />
      </div>
      <div className={`grid gap-4 md:gap-6 lg:gap-7 ${gridCols}`}>
        {items.map((item) => (
          <div className="related-item" data-testid="related-item" key={`${item.type}-${item.id}`}>
            <Link
              href={hrefFor(item, lang)}
              className="group grid overflow-hidden rounded-lg border border-(--hairline) bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)"
            >
              <div className="relative  overflow-hidden bg-[radial-gradient(120%_120%_at_50%_0%,var(--surface),var(--warm-soft))]">
                {item.type === "offer" ? (
                  <OfferIllustration
                    offer={{ slug: item.slug, name: item.name, imagePath: item.imagePath ?? "" }}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : item.type === "collection" ? (
                  <CollectionIllustration
                    collection={{ slug: item.slug, name: item.name, imagePath: item.imagePath ?? "" }}
                    lang={lang}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <ProductIllustration
                    product={{ slug: item.slug, name: item.name, imagePath: item.imagePath ?? "" }}
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="grid gap-2 p-4 sm:p-5">
                <h3 className={lang === "ar"
                  ? "m-0 text-base font-bold font-(family-name:--font-ar) leading-tight text-ink"
                  : "m-0 text-[17px] font-(--font-display) leading-[1.15] text-ink"}>
                  {pickLang(item.name, lang)}
                </h3>
                <div className="mt-1 flex items-end gap-2 border-t border-(--hairline) pt-3">
                  <span className={lang === "ar"
                    ? "text-lg font-bold font-(family-name:--font-ar) leading-none text-accent"
                    : "text-xl font-(--font-display) leading-none text-accent"}>
                    {formatPrice(item.price, lang)}
                  </span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
