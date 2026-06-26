"use client";

import type { StorefrontCategory } from "@/lib/categories";
import type { Language } from "@minikoshk/shared";
import { useLocale } from "../i18n/LocaleProvider";

function CategoryCard({ category, lang }: { category: StorefrontCategory; lang: Language }) {
  const label = category.name[lang];

  return (
    <a
      href={`/${lang}/shop?category=${category.slug}`}
      className="group flex items-start justify-start transition-transform duration-200 hover:-translate-y-0.5"
    >
      <img
        src={category.imagePath ?? ""}
        alt={label}
        className="object-contain transition-transform duration-200 group-hover:scale-105"
      />
    </a>
  );
}

/**
 * "Shop by category" strip: a row of pill cards for the depth-1 categories that
 * carry an image. The caller passes already-filtered categories
 * (see `selectShopByCategories`).
 */
export function ShopByCategory({ categories }: { categories: StorefrontCategory[] }) {
  const { lang, dict } = useLocale();

  if (categories.length === 0) {
    return null;
  }

  const headingClass = "font-heading text-xl font-bold tracking-[0.25em] text-brand-dark uppercase whitespace-nowrap";

  return (
    <section aria-label="Shop by category" role="region" className="py-8">
      <h2 className="mb-4 flex items-center gap-3">
        <span className={headingClass}>{dict.shop.shopByCategoryTop}</span>
        <span className="h-px flex-1 bg-black" aria-hidden />
        <span className={headingClass}>{dict.shop.shopByCategoryBottom}</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} lang={lang} />
        ))}
      </div>
    </section>
  );
}
