"use client";

import { useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { ProductCard } from "./ProductCard";
import { PagerControls, useVisibleCount } from "./carousel-ui";
import { clampStart, maxStart, trackTransform } from "@/lib/carousel";
import type { StorefrontProduct } from "@/lib/products";

function SectionHeading({ top, bottom }: { top: string; bottom: string }) {
  const headingClass =
    "font-heading text-xl font-bold tracking-[0.25em] text-brand-dark uppercase whitespace-nowrap";
  return (
    <h2 className="mb-5 flex items-center gap-3">
      <span className={headingClass}>{top}</span>
      <span className="h-px flex-1 bg-black" aria-hidden />
      <span className={headingClass}>{bottom}</span>
    </h2>
  );
}

export function BestSellers({
  products,
  variant = "slider"
}: {
  products: StorefrontProduct[];
  variant?: "slider" | "grid";
}) {
  const { lang, dict } = useLocale();
  const viewportRef = useRef<HTMLDivElement>(null);
  const visible = useVisibleCount(viewportRef, { minCardWidth: 240, maxVisible: 4 });
  const total = products.length;
  const [start, setStart] = useState(0);

  if (total === 0) {
    return null;
  }

  if (variant === "grid") {
    return (
      <section aria-label="Best sellers" role="region" className="py-8">
        <SectionHeading top={dict.shop.bestSellersTop} bottom={dict.shop.bestSellersBottom} />
        <div className="grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
          ))}
        </div>
      </section>
    );
  }

  const safeStart = clampStart(start, total, visible);
  const steps = maxStart(total, visible);
  const showPrevious = () => setStart((current) => clampStart(current - 1, total, visible));
  const showNext = () => setStart((current) => clampStart(current + 1, total, visible));

  return (
    <section aria-label="Best sellers" role="region" className="py-8">
      <SectionHeading top={dict.shop.bestSellersTop} bottom={dict.shop.bestSellersBottom} />
      <div ref={viewportRef} className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: trackTransform(safeStart, visible) }}
        >
          {products.map((product) => (
            <div key={product.id} className="box-border shrink-0 px-2" style={{ flexBasis: `${100 / visible}%` }}>
              <ProductCard product={product} lang={lang} dict={dict} />
            </div>
          ))}
        </div>
      </div>
      {steps > 0 && (
        <PagerControls
          ariaLabel="Best sellers"
          count={steps + 1}
          index={safeStart}
          dotNoun="position"
          onPrevious={showPrevious}
          onNext={showNext}
          onSelect={setStart}
        />
      )}
      <div className="mt-5 flex justify-center">
        <a
          href={`/${lang}/bestsellers`}
          className="rounded-full border border-brand-dark px-7 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-brand-dark transition-colors hover:bg-brand-dark hover:text-white"
        >
          {dict.shop.viewAll}
        </a>
      </div>
    </section>
  );
}
