"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { StorefrontProductDetail } from "@/lib/products";

/** Long-form copy blocks (description, ingredients, how-to-use, warnings) under the product hero. */
export function ProductInfoSections({ product }: { product: StorefrontProductDetail }) {
  const { lang, dict } = useLocale();
  const sections = [
    { title: dict.productDetail.description, body: product.description?.[lang] },
    { title: dict.productDetail.ingredients, body: product.ingredients?.[lang] },
    { title: dict.productDetail.howToUse, body: product.howToUse?.[lang] },
    { title: dict.productDetail.warnings, body: product.warnings?.[lang] }
  ].filter((section) => Boolean(section.body?.trim()));

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10">
      {sections.map((section) => (
        <section key={section.title} className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">{section.title}</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-brand-dark">{section.body}</p>
        </section>
      ))}
    </div>
  );
}
