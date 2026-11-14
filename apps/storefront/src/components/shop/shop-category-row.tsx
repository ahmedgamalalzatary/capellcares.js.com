import Image from "next/image";
import Link from "next/link";
import { compareByScopedOrdering, pickLang, type Category, type Language } from "@capella/shared";
import { buildCategoryHref, isListedCategory } from "@/lib/category-links";
import { ShopCardRow } from "@/components/shop/shop-card-row";

/** The page-language shop picture of a main category, falling back to the other language's; null when it has neither. (In the ERP a main category's pictures are its two shop pictures.) */
function shopPictureFor(category: Category, lang: Language) {
  return lang === "ar"
    ? category.arShopImagePath || category.enShopImagePath || null
    : category.enShopImagePath || category.arShopImagePath || null;
}

/** Shop page "Categories" row, laid out like Falta's: every listed main category that has a shop picture, in the ERP tree order, as 1:1.6 portrait picture cards in one sideways row (swipe on phones, arrows on desktop). */
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
      <ShopCardRow lang={lang} cols={5}>
        {items.map(({ category, picture }) => {
          const name = pickLang(category.name, lang);
          return (
            <Link
              key={category.id}
              href={buildCategoryHref(lang, category)}
              className="group flex h-full flex-col text-center text-ink transition-transform duration-200 hover:-translate-y-0.5"
            >
              {/* The picture stands alone: rounded top corners, no line along its bottom edge. */}
              <span className="relative block aspect-5/8 overflow-hidden rounded-t-lg border border-b-0 border-(--hairline) bg-surface">
                <Image
                  src={picture}
                  alt={name}
                  fill
                  sizes="(min-width: 1024px) 17vw, (min-width: 640px) 23vw, 34vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className={`mt-2.5 text-sm font-bold leading-tight sm:text-base ${isAr ? "font-(family-name:--font-ar)" : "uppercase tracking-[0.04em]"}`}>
                {name}
              </span>
            </Link>
          );
        })}
      </ShopCardRow>
    </section>
  );
}
