import Image from "next/image";
import Link from "next/link";
import { compareByScopedOrdering, pickLang, type Category, type Language } from "@capella/shared";
import { buildCategoryHref, isListedCategory } from "@/lib/category-links";

/** The page-language picture of a main category, falling back to the other language's; null when it has neither. */
function shopPictureFor(category: Category, lang: Language) {
  return lang === "ar"
    ? category.arShopImagePath || category.enShopImagePath || null
    : category.enShopImagePath || category.arShopImagePath || null;
}

/** Shop page "Categories" row: every listed main category that has a shop picture, in the ERP tree order, scrolling sideways. */
export function ShopCategoryRow({ categories, lang, title }: { categories: Category[]; lang: Language; title: string }) {
  const items = categories
    .filter((category) => category.parentId === null && isListedCategory(category))
    .sort(compareByScopedOrdering.bind(null, "erp"))
    .map((category) => ({ category, picture: shopPictureFor(category, lang) }))
    .filter((item): item is { category: Category; picture: string } => item.picture !== null);
  if (items.length === 0) return null;

  const isAr = lang === "ar";
  return (
    <section aria-labelledby="shop-categories-title" className="mb-8">
      <h2
        id="shop-categories-title"
        className={isAr
          ? "m-0 mb-6 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
          : "m-0 mb-6 text-[clamp(24px,2.4vw,36px)] font-(--font-display) font-bold uppercase leading-[1.1] tracking-[-0.005em] text-ink"}
      >
        {title}
      </h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map(({ category, picture }) => {
          const name = pickLang(category.name, lang);
          return (
            <Link
              key={category.id}
              href={buildCategoryHref(lang, category)}
              className="group grid w-32 shrink-0 snap-start gap-2 sm:w-40 lg:w-48"
            >
              <span className="relative block aspect-square overflow-hidden rounded-lg bg-(--warm-soft)">
                <Image
                  src={picture}
                  alt={name}
                  fill
                  sizes="(min-width: 1024px) 192px, (min-width: 640px) 160px, 128px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="truncate text-center text-sm font-bold text-ink sm:text-base">{name}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
