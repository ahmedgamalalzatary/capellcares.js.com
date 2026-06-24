import Link from "next/link";
import { pickLang, type Category, type Language } from "@capella/shared";

// ZEE-style "Shop by Category" pill-chip row.
export function CategoryStrip({ lang, categories }: { lang: Language; categories: Category[] }) {
  const isAr = lang === "ar";
  const items = categories.filter((c) => !c.deletedAt && c.isLeaf).slice(0, 12);
  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center justify-between">
        <span className="eyebrow">{isAr ? "تسوّقي حسب" : "Shop by"}</span>
        <span className="eyebrow">{isAr ? "الفئة" : "Category"}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/${lang}/products?category=${c.slug}`}
            className="chip"
          >
            <span
              aria-hidden
              className="grid h-5 w-5 place-items-center rounded-full bg-(--accent-soft) text-[10px] font-bold text-accent"
            >
              {pickLang(c.name, lang).trim().charAt(0)}
            </span>
            {pickLang(c.name, lang)}
          </Link>
        ))}
      </div>
    </section>
  );
}
