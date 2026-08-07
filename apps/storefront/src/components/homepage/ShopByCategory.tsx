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
      {/* `w-full` keeps the chip inside its cell — the source images are wider
          than a column, and in the mobile strip that would blow out the scroll
          width. */}
      <img
        src={category.imagePath ?? ""}
        alt={label}
        className="h-auto w-full object-contain transition-transform duration-200 group-hover:scale-105"
      />
    </a>
  );
}

/**
 * "Shop by category" strip: a row of pill cards for root and depth-1 categories
 * that carry an image. The caller passes already-filtered categories
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
      {/* Mobile: two rows that scroll sideways, bled to the screen edges so the
          strip reads as continuing past the viewport. From 600px it becomes the
          wrapping grid again. */}
      <div className="-mx-6 grid auto-cols-[46%] grid-flow-col grid-rows-2 gap-3 overflow-x-auto scroll-smooth px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[600px]:mx-0 min-[600px]:auto-cols-auto min-[600px]:grid-flow-row min-[600px]:grid-cols-3 min-[600px]:grid-rows-none min-[600px]:overflow-x-visible min-[600px]:px-0 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} lang={lang} />
        ))}
      </div>
    </section>
  );
}
