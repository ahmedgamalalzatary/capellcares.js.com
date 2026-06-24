import Link from "next/link";
import type { Category, Dict, Language } from "@capella/shared";

export function CategoryStrip({
  categories,
  lang,
  dict
}: {
  categories: Category[];
  lang: Language;
  dict: Dict;
}) {
  const top = categories.filter((c) => c.parentId === null).slice(0, 10);
  if (top.length === 0) return null;

  return (
    <section className="container" style={{ marginTop: 40 }}>
      <div className="pill-group" style={{ justifyContent: "center", gap: 10 }}>
        <Link href={`/${lang}/products`} className="chip chip--active">
          {dict.nav.allCategories}
        </Link>
        {top.map((cat) => (
          <Link key={cat.id} href={`/${lang}/category/${cat.slug}`} className="chip">
            {cat.name[lang] ?? cat.name.en}
          </Link>
        ))}
      </div>
    </section>
  );
}
